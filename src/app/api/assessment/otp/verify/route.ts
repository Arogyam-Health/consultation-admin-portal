import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { hashOtp, timingSafeCompare } from '@/lib/otp';
import { normalizePhone } from '@/lib/phone/normalize';
import { ok, badRequest, serverError } from '@/lib/api/response';

const VerifySchema = z.object({
  session_id: z.string().uuid(),
  otp: z.string().length(6).regex(/^\d{6}$/),
  phone: z.string(),
  session_token: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    let phone: string;
    try {
      phone = normalizePhone(parsed.data.phone);
    } catch {
      return badRequest('Invalid phone number.');
    }

    const { session_id, otp, session_token } = parsed.data;

    const { data: record, error } = await supabaseAdmin
      .from('consultant_otp_verifications')
      .select('*')
      .eq('session_id', session_id)
      .eq('phone', phone)
      .single();

    if (error || !record) return badRequest('OTP session not found.');

    if (record.is_verified) return badRequest('OTP already used.');

    if (new Date(record.expires_at) < new Date()) {
      return badRequest('OTP has expired. Please request a new one.');
    }

    if (record.attempts >= 5) {
      return badRequest('Maximum attempts exceeded. Please request a new OTP.');
    }

    await supabaseAdmin
      .from('consultant_otp_verifications')
      .update({ attempts: record.attempts + 1 })
      .eq('id', record.id);

    const storedHash = record.otp_hash;
    const isValid = storedHash
      ? timingSafeCompare(storedHash, hashOtp(otp))
      : record.otp_code === otp;

    if (!isValid) {
      const remaining = 4 - record.attempts;
      return badRequest(`Invalid OTP. ${remaining} attempt(s) remaining.`);
    }

    await supabaseAdmin
      .from('consultant_otp_verifications')
      .update({ is_verified: true, verified_at: new Date().toISOString() })
      .eq('id', record.id);

    // Update assessment session phone_verified
    if (session_token) {
      await supabaseAdmin
        .from('consultant_assessment_sessions')
        .update({ phone, phone_verified: true })
        .eq('session_token', session_token);
    }

    return ok({
      verified: true,
      phone,
      session_id,
      message: 'Phone number verified successfully.',
    });
  } catch (err) {
    return serverError(err);
  }
}
