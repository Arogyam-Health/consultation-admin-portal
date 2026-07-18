import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, badRequest, serverError, notFound } from '@/lib/api/response';

const FreezeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const { data, error } = await supabaseAdmin
      .from('consultant_frozen_dates')
      .select('id, frozen_date, created_at')
      .order('frozen_date', { ascending: true });
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
    const parsed = FreezeSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    // Resolve default consultant
    const envId = process.env.DEFAULT_CONSULTANT_ID;
    let consultantId = envId;
    if (!consultantId) {
      const { data: c } = await supabaseAdmin
        .from('consultant_profiles')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (!c) return badRequest('No active consultant found. Set DEFAULT_CONSULTANT_ID.');
      consultantId = c.id;
    }

    const { data: existing } = await supabaseAdmin
      .from('consultant_frozen_dates')
      .select('id')
      .eq('consultant_id', consultantId)
      .eq('frozen_date', parsed.data.date)
      .maybeSingle();

    if (existing) return ok({ frozen: true, date: parsed.data.date });

    const { error } = await supabaseAdmin
      .from('consultant_frozen_dates')
      .insert({ consultant_id: consultantId, frozen_date: parsed.data.date });
    if (error) throw error;

    return ok({ frozen: true, date: parsed.data.date });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    requireAdmin(req);
    const date = req.nextUrl.searchParams.get('date');
    if (!date) return badRequest('date query param required (YYYY-MM-DD)');

    const envId = process.env.DEFAULT_CONSULTANT_ID;
    let consultantId = envId;
    if (!consultantId) {
      const { data: c } = await supabaseAdmin
        .from('consultant_profiles')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (!c) return badRequest('No active consultant found');
      consultantId = c.id;
    }

    const { data: existing } = await supabaseAdmin
      .from('consultant_frozen_dates')
      .select('id')
      .eq('consultant_id', consultantId)
      .eq('frozen_date', date)
      .maybeSingle();

    if (!existing) return notFound('Date not frozen');

    const { error } = await supabaseAdmin
      .from('consultant_frozen_dates')
      .delete()
      .eq('id', existing.id);
    if (error) throw error;

    return ok({ unfrozen: true, date });
  } catch (err) {
    return serverError(err);
  }
}
