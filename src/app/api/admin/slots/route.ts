import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, badRequest, serverError } from '@/lib/api/response';
import { generateSlots } from '@/lib/slots/generator';
import { broadcastSlotUpdate } from '@/lib/websocket/server';

const DURATIONS = [15, 20, 30, 45, 60] as const;

const GenerateSchema = z.object({
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  duration_minutes: z.number().int().refine(d => (DURATIONS as readonly number[]).includes(d)),
  break_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  break_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  include_blocked: z.boolean().default(false),
}).refine(d => d.to_date >= d.from_date, { message: 'to_date must be >= from_date' });

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    // Auto-cleanup: delete past non-booked slots (keep booked ones for records)
    const today = new Date().toISOString().split('T')[0];
    await supabaseAdmin
      .from('consultant_slots')
      .delete()
      .lt('slot_date', today)
      .in('status', ['available', 'expired', 'blocked']);

    const p = req.nextUrl.searchParams;
    const from = p.get('from');
    const to = p.get('to');
    const status = p.get('status');

    let query = supabaseAdmin
      .from('consultant_slots')
      .select('*')
      .order('start_time', { ascending: true });

    if (from) query = query.gte('slot_date', from);
    if (to) query = query.lte('slot_date', to);
    if (status) query = query.eq('status', status);

    const { data, error } = await query.limit(500);
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
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const result = await generateSlots({
      fromDate: parsed.data.from_date,
      toDate: parsed.data.to_date,
      startTime: parsed.data.start_time,
      endTime: parsed.data.end_time,
      durationMinutes: parsed.data.duration_minutes,
      breakStart: parsed.data.break_start,
      breakEnd: parsed.data.break_end,
      includeBlocked: parsed.data.include_blocked,
    });

    broadcastSlotUpdate({
      type: 'slot_updated',
      payload: { message: 'Slots generated', ...result },
      timestamp: new Date().toISOString(),
    });

    return ok(result);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    requireAdmin(req);
    const p = req.nextUrl.searchParams;
    const from = p.get('from');
    const to = p.get('to');
    const status = p.get('status') || 'available';

    if (!from || !to) return badRequest('from and to are required');

    const { data: deleted, error } = await supabaseAdmin
      .from('consultant_slots')
      .delete()
      .gte('slot_date', from)
      .lte('slot_date', to)
      .eq('status', status)
      .select('id');

    if (error) throw error;

    broadcastSlotUpdate({
      type: 'slot_released',
      payload: { count: deleted?.length || 0 },
      timestamp: new Date().toISOString(),
    });

    return ok({ deleted: deleted?.length || 0 });
  } catch (err) {
    return serverError(err);
  }
}
