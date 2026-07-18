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
 * /api/admin/bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: List bookings with filters
 */
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const p = req.nextUrl.searchParams;

    let query = supabaseAdmin
      .from('consultant_bookings')
      .select('*, slots:consultant_slots(start_time, end_time, duration_mins), consultants:consultant_profiles(full_name)')
      .order('created_at', { ascending: false });

    const status = p.get('status');
    const consultantId = p.get('consultant_id');
    const date = p.get('date');

    if (status) query = query.eq('status', status);
    if (consultantId) query = query.eq('consultant_id', consultantId);
    if (date) {
      // Filter by the slot's date via join
      query = query.eq('consultant_slots.slot_date', date);
    }

    const { data, error } = await query.limit(200);
    if (error) throw error;
    return ok(data);
  } catch (err) {
    return serverError(err);
  }
}
