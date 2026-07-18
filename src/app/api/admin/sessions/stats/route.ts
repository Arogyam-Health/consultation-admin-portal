import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, serverError } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const { count: total } = await supabaseAdmin
      .from('consultant_assessment_sessions')
      .select('*', { count: 'exact', head: true });

    const { count: verified } = await supabaseAdmin
      .from('consultant_assessment_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('phone_verified', true);

    const { count: reportGenerated } = await supabaseAdmin
      .from('consultant_assessment_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('report_generated', true);

    return ok({ total: total ?? 0, verified: verified ?? 0, report_generated: reportGenerated ?? 0 });
  } catch (err) {
    return serverError(err);
  }
}
