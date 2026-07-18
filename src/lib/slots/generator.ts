import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { supabaseAdmin } from '@/lib/supabase';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);

const DEFAULT_TZ = 'Asia/Kolkata';

export interface GenerateSlotsOptions {
  fromDate: string;
  toDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  breakStart?: string;
  breakEnd?: string;
  /** If true, also delete blocked slots before regenerating */
  includeBlocked?: boolean;
}

/**
 * resolve the default consultant ID from env or first active profile.
 */
async function resolveConsultantId(): Promise<string> {
  const envId = process.env.DEFAULT_CONSULTANT_ID;
  if (envId) return envId;

  const { data, error } = await supabaseAdmin
    .from('consultant_profiles')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) throw new Error('No active consultant found. Set DEFAULT_CONSULTANT_ID in env.');
  return data.id;
}

export async function generateSlots(opts: GenerateSlotsOptions) {
  const consultantId = await resolveConsultantId();
  const tz = DEFAULT_TZ;

  const {
    fromDate, toDate, startTime, endTime, durationMinutes,
    breakStart, breakEnd, includeBlocked = false,
  } = opts;

  const result = {
    created: 0,
    duplicates_skipped: 0,
    booked_preserved: 0,
    blocked_preserved: 0,
    invalid_skipped: 0,
    frozen_skipped: 0,
    past_deleted: 0,
  };

  // Fetch frozen dates for this consultant
  const { data: frozenRows } = await supabaseAdmin
    .from('consultant_frozen_dates')
    .select('date')
    .eq('consultant_id', consultantId);
  const frozenDates = new Set((frozenRows || []).map(r => r.date));

  // Clean up past slots (older than today) to keep DB lean
  {
    const today = dayjs().format('YYYY-MM-DD');
    const { data: deleted } = await supabaseAdmin
      .from('consultant_slots')
      .delete()
      .eq('consultant_id', consultantId)
      .lt('slot_date', today)
      .select('id');
    result.past_deleted = deleted?.length || 0;
  }

  // Always delete existing available + expired slots in non-frozen dates before regenerating
  {
    const statusFilter = includeBlocked ? ['available', 'expired', 'blocked'] : ['available', 'expired'];
    let delQuery = supabaseAdmin
      .from('consultant_slots')
      .delete()
      .eq('consultant_id', consultantId)
      .gte('slot_date', fromDate)
      .lte('slot_date', toDate)
      .in('status', statusFilter);

    // Exclude frozen dates so their slots are preserved
    const frozenArr = Array.from(frozenDates);
    if (frozenArr.length > 0) {
      for (const fd of frozenArr) {
        delQuery = delQuery.neq('slot_date', fd);
      }
    }

    const { error: delErr } = await delQuery;
    if (delErr) console.error('[Generator] Delete error:', delErr.message);
  }

  // Count preserved bookings
  const { count: bookedCount } = await supabaseAdmin
    .from('consultant_slots')
    .select('id', { count: 'exact', head: true })
    .eq('consultant_id', consultantId)
    .gte('slot_date', fromDate)
    .lte('slot_date', toDate)
    .eq('status', 'booked');
  result.booked_preserved = bookedCount || 0;

  if (!includeBlocked) {
    const { count: blockedCount } = await supabaseAdmin
      .from('consultant_slots')
      .select('id', { count: 'exact', head: true })
      .eq('consultant_id', consultantId)
      .gte('slot_date', fromDate)
      .lte('slot_date', toDate)
      .eq('status', 'blocked');
    result.blocked_preserved = blockedCount || 0;
  }

  // Parse break
  let breakStartMin = -1;
  let breakEndMin = -1;
  if (breakStart && breakEnd) {
    const [bsH, bsM] = breakStart.split(':').map(Number);
    const [beH, beM] = breakEnd.split(':').map(Number);
    breakStartMin = bsH * 60 + bsM;
    breakEndMin = beH * 60 + beM;
  }

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startTotalMin = startH * 60 + startM;
  const endTotalMin = endH * 60 + endM;

  // Fetch existing slots for duplicate check
  const { data: existingSlots } = await supabaseAdmin
    .from('consultant_slots')
    .select('start_time')
    .eq('consultant_id', consultantId)
    .gte('slot_date', fromDate)
    .lte('slot_date', toDate);

  const existingStartTimes = new Set((existingSlots || []).map(s => s.start_time));

  const now = dayjs();

  let current = dayjs(fromDate);
  const end = dayjs(toDate);

  while (!current.isAfter(end)) {
    const dateStr = current.format('YYYY-MM-DD');

    // Skip frozen dates
    if (frozenDates.has(dateStr)) {
      result.frozen_skipped++;
      current = current.add(1, 'day');
      continue;
    }

    let slotStartMin = startTotalMin;

    while (slotStartMin + durationMinutes <= endTotalMin) {
      const slotEndMin = slotStartMin + durationMinutes;

      // Skip break overlap
      if (breakStartMin >= 0) {
        if (
          (slotStartMin >= breakStartMin && slotStartMin < breakEndMin) ||
          (slotEndMin > breakStartMin && slotEndMin <= breakEndMin) ||
          (slotStartMin <= breakStartMin && slotEndMin >= breakEndMin)
        ) {
          slotStartMin = breakEndMin; // Jump to end of break
          continue;
        }
      }

      const slotStartIso = dayjs.tz(`${dateStr} ${String(Math.floor(slotStartMin / 60)).padStart(2, '0')}:${String(slotStartMin % 60).padStart(2, '0')}:00`, tz).toISOString();
      const slotEndIso = dayjs.tz(`${dateStr} ${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}:00`, tz).toISOString();

      // Skip past times
      if (dayjs(slotStartIso).isBefore(now)) {
        result.invalid_skipped++;
        slotStartMin = slotEndMin;
        continue;
      }

      // Skip duplicate (should not happen since we delete first, but guard against race conditions)
      if (existingStartTimes.has(slotStartIso)) {
        result.duplicates_skipped++;
        slotStartMin = slotEndMin;
        continue;
      }

      // Insert slot
      const { error: insErr } = await supabaseAdmin
        .from('consultant_slots')
        .insert({
          consultant_id: consultantId,
          slot_date: dateStr,
          start_time: slotStartIso,
          end_time: slotEndIso,
          duration_mins: durationMinutes,
          status: 'available',
        });

      if (insErr) {
        if (insErr.message?.includes('duplicate') || insErr.code === '23505') {
          result.duplicates_skipped++;
        } else {
          console.error('[Generator] Insert error:', insErr.message);
        }
      } else {
        result.created++;
        existingStartTimes.add(slotStartIso);
      }

      slotStartMin = slotEndMin;
    }

    current = current.add(1, 'day');
  }

  return result;
}
