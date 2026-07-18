import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ok, badRequest, serverError } from '@/lib/api/response';

/**
 * @swagger
 * /api/slots:
 *   get:
 *     tags: [Public Slots]
 *     summary: Get available slots for a date range (public, no auth)
 *     description: |
 *       Returns all slots for the given date range.
 *       Available slots are shown normally; booked/blocked slots are returned
 *       with status so the UI can display them greyed-out.
 *     parameters:
 *       - in: query
 *         name: consultant_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date }
 *         example: '2026-07-15'
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date }
 *         example: '2026-07-21'
 *     responses:
 *       200:
 *         description: List of slots with status
 */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const from = p.get('from');
    const to = p.get('to');
    const consultantId = p.get('consultant_id');

    if (!from || !to) return badRequest('from and to date parameters are required');

    let query = supabaseAdmin
      .from('consultant_slots')
      .select('id, consultant_id, slot_date, start_time, end_time, duration_mins, status, consultants:consultant_profiles(full_name, avatar_url)')
      .gte('slot_date', from)
      .lte('slot_date', to)
      .order('start_time', { ascending: true });

    if (consultantId) query = query.eq('consultant_id', consultantId);

    const { data, error } = await query.limit(500);
    if (error) throw error;

    return ok(data || []);
  } catch (err) {
    return serverError(err);
  }
}
