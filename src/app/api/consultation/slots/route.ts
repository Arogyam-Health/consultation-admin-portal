import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ok, badRequest, serverError } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const from = p.get('from');
    const to = p.get('to');
    const tz = p.get('timezone') || 'Asia/Kolkata';

    if (!from || !to) return badRequest('from and to date parameters are required');

    const { data: slots, error } = await supabaseAdmin
      .from('consultant_slots')
      .select('id, consultant_id, slot_date, start_time, end_time, duration_mins, status')
      .gte('slot_date', from)
      .lte('slot_date', to)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    if (error) throw error;

    const grouped: Record<string, Array<{
      slotId: string;
      startsAt: string;
      endsAt: string;
      durationMinutes: number;
      status: string;
      available: boolean;
    }>> = {};

    for (const s of slots || []) {
      if (!grouped[s.slot_date]) grouped[s.slot_date] = [];
      grouped[s.slot_date].push({
        slotId: s.id,
        startsAt: s.start_time,
        endsAt: s.end_time,
        durationMinutes: s.duration_mins,
        status: s.status,
        available: s.status === 'available',
      });
    }

    const dates = Object.entries(grouped).map(([date, slotsList]) => ({
      date,
      slots: slotsList,
    }));

    return ok({ timezone: tz, dates });
  } catch (err) {
    return serverError(err);
  }
}
