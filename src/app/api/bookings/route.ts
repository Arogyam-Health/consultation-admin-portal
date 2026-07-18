import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { ok, badRequest, conflict, serverError } from '@/lib/api/response';
import { broadcastSlotUpdate } from '@/lib/websocket/server';

const BookingSchema = z.object({
  slot_id: z.string().uuid(),
  phone: z.string().regex(/^\+[1-9]\d{9,14}$/),
  full_name: z.string().min(2),
  email: z.string().email().optional(),
  session_id: z.string().uuid().optional(),    // assessment session
  otp_session_id: z.string().uuid(),            // must have verified OTP
  shopify_order_id: z.string().optional(),
});

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     tags: [Public Bookings]
 *     summary: Book a consultation slot
 *     description: |
 *       Atomically checks slot availability and creates a booking.
 *       Requires a verified OTP session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slot_id, phone, full_name, otp_session_id]
 *             properties:
 *               slot_id:        { type: string, format: uuid }
 *               phone:          { type: string }
 *               full_name:      { type: string }
 *               email:          { type: string, format: email }
 *               otp_session_id: { type: string, format: uuid }
 *               session_id:     { type: string, format: uuid }
 *     responses:
 *       200: { description: Booking confirmed }
 *       409: { description: Slot already taken }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BookingSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { slot_id, phone, full_name, email, session_id, otp_session_id, shopify_order_id } = parsed.data;

    // 1. Verify OTP session is valid and belongs to this phone
    const { data: otpRecord } = await supabaseAdmin
      .from('consultant_otp_verifications')
      .select('*')
      .eq('session_id', otp_session_id)
      .eq('phone', phone)
      .eq('is_verified', true)
      .single();

    if (!otpRecord) {
      return badRequest('Phone number not verified. Please complete OTP verification first.');
    }

    // 2. Lock and check slot atomically using Supabase transaction
    // We use a SELECT FOR UPDATE equivalent via Supabase RPC
    // First, try to claim the slot by updating status only if it's 'available'
    const { data: updatedSlot, error: slotErr } = await supabaseAdmin
      .from('consultant_slots')
      .update({ status: 'booked' })
      .eq('id', slot_id)
      .eq('status', 'available')   // atomic: only updates if still available
      .select('id, consultant_id, start_time, end_time, duration_mins')
      .single();

    if (slotErr || !updatedSlot) {
      // Slot was booked/blocked by someone else
      return conflict('This slot is no longer available. Please select another slot.');
    }

    // 3. Create the booking
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('consultant_bookings')
      .insert({
        slot_id,
        consultant_id: updatedSlot.consultant_id,
        session_id: session_id || null,
        phone,
        full_name,
        email: email || null,
        status: 'confirmed',
        shopify_order_id: shopify_order_id || null,
      })
      .select()
      .single();

    if (bookingErr) {
      // Rollback slot status
      await supabaseAdmin.from('consultant_slots').update({ status: 'available' }).eq('id', slot_id);
      throw bookingErr;
    }

    // 4. Broadcast real-time update
    broadcastSlotUpdate({
      type: 'slot_booked',
      payload: {
        slot_id,
        start_time: updatedSlot.start_time,
        end_time: updatedSlot.end_time,
      },
      timestamp: new Date().toISOString(),
    });

    return ok({
      booking_id: booking.id,
      slot: updatedSlot,
      message: 'Consultation booked successfully!',
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     tags: [Public Bookings]
 *     summary: Get booking by reference or phone
 */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const phone = p.get('phone');

    if (!phone) return badRequest('phone required');

    let query = supabaseAdmin
      .from('consultant_bookings')
      .select('id, status, full_name, phone, created_at, slots:consultant_slots(slot_date, start_time, end_time), consultants:consultant_profiles(full_name)');

    if (phone) query = query.eq('phone', phone);

    const { data, error } = await query.limit(20);
    if (error) throw error;
    return ok(data);
  } catch (err) {
    return serverError(err);
  }
}
