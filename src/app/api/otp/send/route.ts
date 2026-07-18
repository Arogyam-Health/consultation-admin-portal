import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { getOtpProvider, generateOtp } from '@/lib/otp';
import { ok, badRequest, serverError } from '@/lib/api/response';
import { v4 as uuidv4 } from 'uuid';

const SendSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{9,14}$/, 'Phone must be in E.164 format, e.g. +919876543210'),
});

/**
 * @swagger
 * /api/otp/send:
 *   post:
 *     tags: [OTP]
 *     summary: Send OTP to a phone number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string, example: '+919876543210' }
 *     responses:
 *       200:
 *         description: OTP sent successfully, returns session_id
 *       400:
 *         description: Validation error
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SendSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { phone } = parsed.data;

    // Rate-limit: max 3 OTPs per phone per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('consultant_otp_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', tenMinutesAgo);

    if ((count || 0) >= 3) {
      return badRequest('Too many OTP requests. Please wait 10 minutes before requesting again.');
    }

    const otp = generateOtp();
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry

    // Store OTP in DB
    const { error: dbErr } = await supabaseAdmin
      .from('consultant_otp_verifications')
      .insert({
        phone,
        otp_code: otp,
        session_id: sessionId,
        expires_at: expiresAt,
      });

    if (dbErr) throw dbErr;

    // Send via provider (mock or Vati)
    const provider = getOtpProvider();
    const result = await provider.sendOtp(phone, otp);

    if (!result.success) {
      // Rollback the OTP record
      await supabaseAdmin.from('consultant_otp_verifications').delete().eq('session_id', sessionId);
      return serverError(new Error(`OTP send failed: ${result.error}`));
    }

    return ok({
      session_id: sessionId,
      message: 'OTP sent successfully',
      expires_in_seconds: 600,
      // In mock mode, expose OTP for easy testing
      ...(process.env.OTP_PROVIDER !== 'vati' && { debug_otp: otp }),
    });
  } catch (err) {
    return serverError(err);
  }
}
