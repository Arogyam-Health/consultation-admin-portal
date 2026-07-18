import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, badRequest, notFound, serverError } from '@/lib/api/response';

const UpdateSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  bio: z.string().optional(),
  avatar_url: z.string().url().optional(),
  timezone: z.string().optional(),
  is_active: z.boolean().optional(),
});

/**
 * @swagger
 * /api/admin/consultants/{id}:
 *   get:
 *     tags: [Consultants]
 *     summary: Get consultant by ID
 *   patch:
 *     tags: [Consultants]
 *     summary: Update consultant
 *   delete:
 *     tags: [Consultants]
 *     summary: Deactivate consultant
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('consultant_profiles')
      .select('*, working_hours:consultant_working_hours(*)')
      .eq('id', id)
      .single();

    if (error || !data) return notFound('Consultant not found');
    return ok(data);
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { data, error } = await supabaseAdmin
      .from('consultant_profiles')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return notFound('Consultant not found');
    return ok(data);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const { error } = await supabaseAdmin
      .from('consultant_profiles')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    return ok({ message: 'Consultant deactivated' });
  } catch (err) {
    return serverError(err);
  }
}
