import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { ok, badRequest, serverError } from '@/lib/api/response';
import { v4 as uuidv4 } from 'uuid';
import { sendAssessmentToWebhook } from '@/lib/integrations/webhook';

const SessionSchema = z.object({
  session_token: z.string().optional(),
  phone: z.string().optional(),
  full_name: z.string().optional(),
  age: z.number().int().min(10).max(120).optional(),
  gender: z.string().optional(),
  height_cm: z.number().min(50).max(300).optional(),
  weight_kg: z.number().min(10).max(500).optional(),
  target_weight_kg: z.number().min(10).max(500).optional(),
  barriers: z.array(z.string()).optional(),
  lifestyle: z.array(z.string()).optional(),
  digestive_health: z.array(z.string()).optional(),
  medical_conditions: z.array(z.string()).optional(),
  eligibility: z.array(z.string()).optional(),
  motivation: z.record(z.string(), z.any()).optional(),
  report_generated: z.boolean().optional(),
  report_data: z.record(z.string(), z.any()).optional(),
});

function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 100) / 100;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SessionSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const data: Record<string, unknown> = {};
    const fields = [
      'phone', 'full_name', 'age', 'gender', 'height_cm', 'weight_kg',
      'target_weight_kg', 'barriers', 'lifestyle', 'digestive_health',
      'medical_conditions', 'eligibility', 'motivation', 'report_generated', 'report_data',
    ] as const;

    for (const f of fields) {
      if (parsed.data[f as keyof typeof parsed.data] !== undefined) {
        data[f] = parsed.data[f as keyof typeof parsed.data];
      }
    }

    // Calculate BMI if height and weight are present
    if (parsed.data.height_cm && parsed.data.weight_kg) {
      data.bmi = calculateBMI(parsed.data.weight_kg, parsed.data.height_cm);
    }

    let result;
    if (parsed.data.session_token) {
      const { data: existing } = await supabaseAdmin
        .from('consultant_assessment_sessions')
        .select('id, report_generated, report_data')
        .eq('session_token', parsed.data.session_token)
        .single();

      if (existing) {
        const { data: updated, error } = await supabaseAdmin
          .from('consultant_assessment_sessions')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('session_token', parsed.data.session_token)
          .select()
          .single();

        if (error) throw error;
        result = updated;

        // If report was just generated and wasn't before, send webhook
        if (parsed.data.report_generated && !existing.report_generated) {
          sendAssessmentToWebhook(result).catch(e => console.error('[Webhook] send failed:', e?.message));
        }
      } else {
        return badRequest('Session not found. Create a new session first.');
      }
    } else {
      const sessionToken = uuidv4();
      const { data: created, error } = await supabaseAdmin
        .from('consultant_assessment_sessions')
        .insert({ session_token: sessionToken, ...data })
        .select()
        .single();

      if (error) throw error;
      result = created;
    }

    return ok({
      session_token: result.session_token,
      message: parsed.data.session_token ? 'Session updated' : 'Session created',
      data: result,
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('session_token');
    if (!token) return badRequest('session_token required');

    const { data, error } = await supabaseAdmin
      .from('consultant_assessment_sessions')
      .select('*')
      .eq('session_token', token)
      .single();

    if (error || !data) return badRequest('Session not found');
    return ok(data);
  } catch (err) {
    return serverError(err);
  }
}
