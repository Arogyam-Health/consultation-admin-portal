import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { ok, badRequest, serverError } from '@/lib/api/response';

const VerifySchema = z.object({
  session_id: z.string().uuid(),
  otp: z.string().length(6).regex(/^\d+$/),
  phone: z.string().regex(/^\+[1-9]\d{9,14}$/),
});

/**
 * @swagger
 * /api/otp/verify:
 *   post:
 *     tags: [OTP]
 *     summary: Verify OTP code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [session_id, otp, phone]
 *             properties:
 *               session_id: { type: string, format: uuid }
 *               otp:        { type: string, example: '123456' }
 *               phone:      { type: string, example: '+919876543210' }
 *     responses:
 *       200: { description: OTP verified, returns verification token }
 *       400: { description: Invalid or expired OTP }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { session_id, otp, phone } = parsed.data;

    const { data: record, error } = await supabaseAdmin
      .from('consultant_otp_verifications')
      .select('*')
      .eq('session_id', session_id)
      .eq('phone', phone)
      .single();

    if (error || !record) return badRequest('OTP session not found');

    if (record.is_verified) return badRequest('OTP already used');

    if (new Date(record.expires_at) < new Date()) {
      return badRequest('OTP has expired. Please request a new one.');
    }

    if (record.attempts >= 5) {
      return badRequest('Maximum attempts exceeded. Please request a new OTP.');
    }

    // Increment attempt count
    await supabaseAdmin
      .from('consultant_otp_verifications')
      .update({ attempts: record.attempts + 1 })
      .eq('id', record.id);

    if (record.otp_code !== otp) {
      return badRequest(`Invalid OTP. ${4 - record.attempts} attempts remaining.`);
    }

    // Mark as verified
    await supabaseAdmin
      .from('consultant_otp_verifications')
      .update({ is_verified: true, verified_at: new Date().toISOString() })
      .eq('id', record.id);

    return ok({
      verified: true,
      phone,
      session_id,
      message: 'Phone number verified successfully',
    });
  } catch (err) {
    return serverError(err);
  }
}
