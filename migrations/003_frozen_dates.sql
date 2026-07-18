-- ============================================================
-- The Obesity Killer — Migration 003: Frozen dates & cleanup
-- ============================================================

CREATE TABLE IF NOT EXISTS consultant_frozen_dates (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES consultant_profiles(id) ON DELETE CASCADE,
  date      DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(consultant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_frozen_dates_consultant
  ON consultant_frozen_dates(consultant_id, date);
