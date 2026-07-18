import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { signAdminToken } from '@/lib/auth/jwt';
import { ok, badRequest, unauthorized, serverError } from '@/lib/api/response';

/**
 * @swagger
 * /api/admin/auth/login:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Admin login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid credentials
 */
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { email, password } = parsed.data;

    const { data: admin, error } = await supabaseAdmin
      .from('consultant_admin_users')
      .select('id, email, password_hash, full_name, role, is_active')
      .eq('email', email)
      .single();

    if (error || !admin || !admin.is_active) return unauthorized('Invalid credentials');

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return unauthorized('Invalid credentials');

    // Update last_login_at
    await supabaseAdmin
      .from('consultant_admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);

    const token = signAdminToken({ sub: admin.id, email: admin.email, role: admin.role });

    return ok({ token, admin: { id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role } });
  } catch (err) {
    return serverError(err);
  }
}
