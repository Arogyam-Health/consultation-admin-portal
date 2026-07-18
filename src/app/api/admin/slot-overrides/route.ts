import { NextRequest } from 'next/server';
import { z } from 'zod';
import dayjs from 'dayjs';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, created, badRequest, serverError } from '@/lib/api/response';
import { broadcastSlotUpdate } from '@/lib/websocket/server';

const OverrideSchema = z.object({
  consultant_id: z.string().uuid(),
  override_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slot_duration: z.number().int().refine(d => [15, 20, 30, 45, 60].includes(d)).optional(),
  is_blocked: z.boolean().default(false),
  reason: z.string().optional(),
});

/**
 * @swagger
 * /api/admin/slot-overrides:
 *   get:
 *     tags: [Slot Overrides]
 *     summary: List overrides for a consultant in a date range
 *   post:
 *     tags: [Slot Overrides]
 *     summary: Create or update a date-specific override
 */
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const p = req.nextUrl.searchParams;
    const consultantId = p.get('consultant_id');
    const from = p.get('from');
    const to = p.get('to');

    if (!consultantId) return badRequest('consultant_id required');

    let query = supabaseAdmin
      .from('consultant_slot_overrides')
      .select('*')
      .eq('consultant_id', consultantId)
      .order('override_date');

    if (from) query = query.gte('override_date', from);
    if (to) query = query.lte('override_date', to);

    const { data, error } = await query;
    if (error) throw error;
    return ok(data);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = requireAdmin(req);
    const body = await req.json();
    const parsed = OverrideSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { override_date, from_date, to_date, ...rest } = parsed.data;

    // Resolve the list of dates to upsert
    let dates: string[];
    if (override_date) {
      dates = [override_date];
    } else if (from_date && to_date) {
      if (to_date < from_date) return badRequest('to_date must be >= from_date');
      const datesList: string[] = [];
      let d = dayjs(from_date);
      const end = dayjs(to_date);
      while (!d.isAfter(end)) {
        datesList.push(d.format('YYYY-MM-DD'));
        d = d.add(1, 'day');
      }
      dates = datesList;
    } else {
      return badRequest('Provide either override_date or both from_date and to_date');
    }

    const rows = dates.map(date => ({
      consultant_id: rest.consultant_id,
      override_date: date,
      start_time: rest.start_time,
      end_time: rest.end_time,
      slot_duration: rest.slot_duration,
      is_blocked: rest.is_blocked,
      reason: rest.reason,
      created_by: admin.sub,
    }));

    const { data, error } = await supabaseAdmin
      .from('consultant_slot_overrides')
      .upsert(rows, { onConflict: 'consultant_id,override_date', ignoreDuplicates: false })
      .select();

    if (error) throw error;

    broadcastSlotUpdate({
      type: 'slot_blocked',
      payload: { overrides: data, message: `${dates.length} day(s) updated` },
      timestamp: new Date().toISOString(),
    });

    return created({ overrides: data, count: dates.length });
  } catch (err) {
    return serverError(err);
  }
}
