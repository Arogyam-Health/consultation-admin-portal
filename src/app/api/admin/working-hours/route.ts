import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, created, badRequest, serverError } from '@/lib/api/response';

const DOW = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

const WorkingHoursSchema = z.object({
  consultant_id: z.string().uuid(),
  schedules: z.array(z.object({
    day_of_week: DOW,
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
    slot_duration: z.number().int().refine(d => [15, 20, 30, 45, 60].includes(d)),
    is_active: z.boolean().default(true),
  })).min(1),
});

/**
 * @swagger
 * /api/admin/working-hours:
 *   get:
 *     tags: [Working Hours]
 *     summary: Get working hours for a consultant
 *     parameters:
 *       - in: query
 *         name: consultant_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *   post:
 *     tags: [Working Hours]
 *     summary: Set/replace working hours for a consultant
 */
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const consultantId = req.nextUrl.searchParams.get('consultant_id');
    if (!consultantId) return badRequest('consultant_id is required');

    const { data, error } = await supabaseAdmin
      .from('consultant_working_hours')
      .select('*')
      .eq('consultant_id', consultantId)
      .order('day_of_week');

    if (error) throw error;
    return ok(data);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const parsed = WorkingHoursSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { consultant_id, schedules } = parsed.data;

    // Upsert all schedules
    const rows = schedules.map(s => ({ ...s, consultant_id }));
    const { data, error } = await supabaseAdmin
      .from('consultant_working_hours')
      .upsert(rows, { onConflict: 'consultant_id,day_of_week' })
      .select();

    if (error) throw error;
    return created(data);
  } catch (err) {
    return serverError(err);
  }
}
