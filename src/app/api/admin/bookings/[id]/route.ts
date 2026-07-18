import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, notFound, badRequest, serverError } from '@/lib/api/response';
import { broadcastSlotUpdate } from '@/lib/websocket/server';
import { z } from 'zod';

const UpdateSchema = z.object({
  status: z.enum(['confirmed', 'cancelled', 'completed', 'no_show']),
  cancelled_reason: z.string().optional(),
});

/**
 * @swagger
 * /api/admin/bookings/{id}:
 *   get:
 *     tags: [Bookings]
 *     summary: Get booking detail
 *   patch:
 *     tags: [Bookings]
 *     summary: Update booking status
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('consultant_bookings')
      .select('*, slots:consultant_slots(*), consultants:consultant_profiles(*), assessment_sessions:consultant_assessment_sessions(*)')
      .eq('id', id)
      .single();

    if (error || !data) return notFound('Booking not found');
    return ok(data);
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    // Fetch booking to get slot_id
    const { data: booking } = await supabaseAdmin
      .from('consultant_bookings')
      .select('slot_id, status')
      .eq('id', id)
      .single();

    if (!booking) return notFound('Booking not found');

    const { data, error } = await supabaseAdmin
      .from('consultant_bookings')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If cancelling, release the slot
    if (parsed.data.status === 'cancelled' && booking.slot_id) {
      await supabaseAdmin
        .from('consultant_slots')
        .update({ status: 'available' })
        .eq('id', booking.slot_id);

      broadcastSlotUpdate({
        type: 'slot_released',
        payload: { slot_id: booking.slot_id },
        timestamp: new Date().toISOString(),
      });
    }

    return ok(data);
  } catch (err) {
    return serverError(err);
  }
}
