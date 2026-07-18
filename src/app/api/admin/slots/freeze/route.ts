import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, badRequest, serverError } from '@/lib/api/response';

const FreezeSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
});

async function resolveConsultantId(): Promise<string> {
  const envId = process.env.DEFAULT_CONSULTANT_ID;
  if (envId) return envId;
  const { data } = await supabaseAdmin
    .from('consultant_profiles')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error('No active consultant found');
  return data.id;
}

export async function GET() {
  try {
    const consultantId = await resolveConsultantId();
    const { data } = await supabaseAdmin
      .from('consultant_frozen_dates')
      .select('date')
      .eq('consultant_id', consultantId)
      .order('date', { ascending: true });
    return ok((data || []).map(r => r.date));
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const consultantId = await resolveConsultantId();
    const body = await req.json();
    const parsed = FreezeSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const rows = parsed.data.dates.map(date => ({ consultant_id: consultantId, date }));
    const { data, error } = await supabaseAdmin
      .from('consultant_frozen_dates')
      .upsert(rows, { onConflict: 'consultant_id,date', ignoreDuplicates: true })
      .select('date');

    if (error) throw error;
    return ok({ frozen: (data || []).map(r => r.date) });
  } catch (err) {
    return serverError(err);
  }
}
