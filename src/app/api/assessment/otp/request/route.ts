import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { getOtpProvider, generateOtp, hashOtp } from '@/lib/otp';
import { normalizePhone } from '@/lib/phone/normalize';
import { ok, badRequest, serverError } from '@/lib/api/response';
import { v4 as uuidv4 } from 'uuid';

const RequestSchema = z.object({
  phone: z.string(),
  session_token: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    let phone: string;
    try {
      phone = normalizePhone(parsed.data.phone);
    } catch {
      return badRequest('Invalid phone number. Use a valid Indian mobile number.');
    }

    const provider = getOtpProvider();

    const isMockDev = provider.name === 'mock' && process.env.NODE_ENV !== 'production';
    const devOtp = process.env.MOCK_OTP_CODE || '123456';
    const otp = isMockDev ? devOtp : generateOtp();
    const otpHash = hashOtp(otp);
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Rate limit: max 3 per phone per 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('consultant_otp_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', tenMinAgo);
    if ((count || 0) >= 3) {
      return badRequest('Too many OTP requests. Please wait 10 minutes.');
    }

    // 60-second resend cooldown
    const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from('consultant_otp_verifications')
      .select('id')
      .eq('phone', phone)
      .gte('created_at', oneMinAgo)
      .limit(1);
    if (recent && recent.length > 0) {
      return badRequest('Please wait 60 seconds before requesting another OTP.');
    }

    // Invalidate older unverified OTPs for this phone
    await supabaseAdmin
      .from('consultant_otp_verifications')
      .update({ expires_at: new Date(0).toISOString() })
      .eq('phone', phone)
      .eq('is_verified', false);

    // Clean up old expired entries (older than 1 hour past expiry)
    await supabaseAdmin
      .from('consultant_otp_verifications')
      .delete()
      .lt('expires_at', new Date(Date.now() - 3600 * 1000).toISOString());

    // Store OTP hash
    await supabaseAdmin.from('consultant_otp_verifications').insert({
      phone,
      otp_code: otp,
      otp_hash: otpHash,
      session_id: sessionId,
      expires_at: expiresAt,
    });

    // Send via provider
    const result = await provider.sendOtp(phone, otp);
    if (!result.success) {
      await supabaseAdmin.from('consultant_otp_verifications').delete().eq('session_id', sessionId);
      return serverError(new Error(`OTP send failed: ${result.error}`));
    }

    // If session_token provided, link it
    if (parsed.data.session_token) {
      await supabaseAdmin
        .from('consultant_assessment_sessions')
        .update({ phone })
        .eq('session_token', parsed.data.session_token);
    }

    return ok({
      session_id: sessionId,
      message: 'OTP sent successfully',
      expires_in_seconds: 300,
      ...(isMockDev ? { debug_otp: otp } : {}),
    });
  } catch (err) {
    return serverError(err);
  }
}
