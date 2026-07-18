-- ============================================================
-- The Obesity Killer — Migration 002: Simplify for single-team
-- Safe, additive changes only. No data loss.
-- ============================================================

-- 1. Make phone nullable in assessment_sessions (assessment can
--    be created before lead capture)
ALTER TABLE consultant_assessment_sessions
ALTER COLUMN phone DROP NOT NULL;

-- 2. Add otp_hash column (migrate from plaintext otp_code)
ALTER TABLE consultant_otp_verifications
ADD COLUMN IF NOT EXISTS otp_hash TEXT;

-- 3. Add resend_cooldown tracking
ALTER TABLE consultant_otp_verifications
ADD COLUMN IF NOT EXISTS resent_at TIMESTAMPTZ;

-- 4. Unique partial index to prevent double-booking a slot
--    First check for existing duplicates
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT slot_id FROM consultant_bookings
    WHERE status IN ('pending', 'confirmed')
    GROUP BY slot_id HAVING COUNT(*) > 1
  ) dup;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % slot(s) with duplicate active bookings. Resolve before applying index.', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_booking_per_slot
ON consultant_bookings(slot_id)
WHERE status IN ('pending', 'confirmed');

-- 5. Index for fast available-slot queries
-- NOTE: NOW() cannot be used in a partial index predicate (non-IMMUTABLE).
-- Use application-level filtering for "future" logic.
CREATE INDEX IF NOT EXISTS idx_slots_available
ON consultant_slots(consultant_id, start_time)
WHERE status = 'available';
