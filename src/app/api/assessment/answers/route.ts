import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { ok, badRequest, serverError } from '@/lib/api/response';

const AnswerItem = z.object({
  question_key: z.string().min(1),
  answer: z.any(),
});

const StoreSchema = z.object({
  session_token: z.string().uuid(),
  answers: z.array(AnswerItem).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = StoreSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { session_token, answers } = parsed.data;

    const { data: session, error: sessErr } = await supabaseAdmin
      .from('consultant_assessment_sessions')
      .select('id')
      .eq('session_token', session_token)
      .single();

    if (sessErr || !session) return badRequest('Session not found.');

    const rows = answers.map(a => ({
      session_token,
      question_key: a.question_key,
      answer: a.answer,
    }));

    const { error: upsertErr } = await supabaseAdmin
      .from('consultant_assessment_answers')
      .upsert(rows, { onConflict: 'session_token,question_key', ignoreDuplicates: false });

    if (upsertErr) throw upsertErr;

    const { data: saved } = await supabaseAdmin
      .from('consultant_assessment_answers')
      .select('question_key, answer, updated_at')
      .eq('session_token', session_token)
      .order('question_key');

    return ok({ session_token, answers: saved });
  } catch (err) {
    return serverError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('session_token');
    if (!token) return badRequest('session_token required');

    const { data: answers, error } = await supabaseAdmin
      .from('consultant_assessment_answers')
      .select('question_key, answer, created_at, updated_at')
      .eq('session_token', token)
      .order('question_key');

    if (error) throw error;

    return ok({ session_token: token, answers: answers || [] });
  } catch (err) {
    return serverError(err);
  }
}
