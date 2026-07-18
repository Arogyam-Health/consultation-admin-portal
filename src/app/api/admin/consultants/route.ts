import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, created, badRequest, notFound, serverError } from '@/lib/api/response';

/**
 * @swagger
 * /api/admin/consultants:
 *   get:
 *     tags: [Consultants]
 *     summary: List all consultants
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: List of consultants }
 *   post:
 *     tags: [Consultants]
 *     summary: Create a new consultant
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ConsultantInput' }
 */

const ConsultantSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  bio: z.string().optional(),
  avatar_url: z.string().url().optional(),
  timezone: z.string().default('Asia/Kolkata'),
});

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const { data, error } = await supabaseAdmin
      .from('consultant_profiles')
      .select('*')
      .order('created_at', { ascending: false });

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
    const parsed = ConsultantSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { data, error } = await supabaseAdmin
      .from('consultant_profiles')
      .insert(parsed.data)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return badRequest('Email already exists');
      throw error;
    }
    return created(data);
  } catch (err) {
    return serverError(err);
  }
}
