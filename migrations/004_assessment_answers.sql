-- ============================================================
-- The Obesity Killer — Migration 004: Assessment answers
-- ============================================================

CREATE TABLE IF NOT EXISTS consultant_assessment_answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT NOT NULL REFERENCES consultant_assessment_sessions(session_token) ON DELETE CASCADE,
  question_key  TEXT NOT NULL,
  answer        JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_token, question_key)
);

CREATE INDEX IF NOT EXISTS idx_assessment_answers_session
  ON consultant_assessment_answers(session_token);
