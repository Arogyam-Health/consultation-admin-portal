import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, created, badRequest, serverError } from '@/lib/api/response';

const LeaveSchema = z.object({
  consultant_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
}).refine(d => d.end_date >= d.start_date, { message: 'end_date must be >= start_date' });

/**
 * @swagger
 * /api/admin/leaves:
 *   get:
 *     tags: [Leaves]
 *     summary: List leaves for a consultant
 *   post:
 *     tags: [Leaves]
 *     summary: Create a leave block
 */
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const consultantId = req.nextUrl.searchParams.get('consultant_id');
    if (!consultantId) return badRequest('consultant_id required');

    const { data, error } = await supabaseAdmin
      .from('consultant_leaves')
      .select('*')
      .eq('consultant_id', consultantId)
      .order('start_date');

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
    const parsed = LeaveSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { data, error } = await supabaseAdmin
      .from('consultant_leaves')
      .insert({ ...parsed.data, created_by: admin.sub })
      .select()
      .single();

    if (error) throw error;
    return created(data);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    requireAdmin(req);
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return badRequest('id required');

    const { error } = await supabaseAdmin
      .from('consultant_leaves')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return ok({ message: 'Leave deleted' });
  } catch (err) {
    return serverError(err);
  }
}
