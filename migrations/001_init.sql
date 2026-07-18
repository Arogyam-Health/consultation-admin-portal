-- ============================================================
-- The Obesity Killer — Database Migration 001 (Initial Schema)
-- Run this in Supabase SQL Editor or via psql
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUM Types ───────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE slot_status AS ENUM ('available', 'booked', 'blocked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE day_of_week AS ENUM ('monday','tuesday','wednesday','thursday','friday','saturday','sunday');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── consultant_admin_users ───────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin','admin')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── consultant_profiles ──────────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  specialization TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  timezone      TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── consultant_working_hours ─────────────────────────────
-- Defines the default weekly schedule per consultant
CREATE TABLE IF NOT EXISTS consultant_working_hours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   UUID NOT NULL REFERENCES consultant_profiles(id) ON DELETE CASCADE,
  day_of_week     day_of_week NOT NULL,
  start_time      TIME NOT NULL,   -- e.g. 09:00
  end_time        TIME NOT NULL,   -- e.g. 17:00
  slot_duration   INTEGER NOT NULL DEFAULT 30 CHECK (slot_duration IN (15,20,30,45,60)),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(consultant_id, day_of_week)
);

-- ─── consultant_slot_overrides ────────────────────────────
-- Date-specific overrides: custom hours, duration change, or full-day block
CREATE TABLE IF NOT EXISTS consultant_slot_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   UUID NOT NULL REFERENCES consultant_profiles(id) ON DELETE CASCADE,
  override_date   DATE NOT NULL,
  start_time      TIME,            -- NULL = use working_hours default
  end_time        TIME,            -- NULL = use working_hours default
  slot_duration   INTEGER CHECK (slot_duration IN (15,20,30,45,60)),
  is_blocked      BOOLEAN NOT NULL DEFAULT false,  -- true = block entire day
  reason          TEXT,
  created_by      UUID REFERENCES consultant_admin_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(consultant_id, override_date)
);

-- ─── consultant_leaves ────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_leaves (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   UUID NOT NULL REFERENCES consultant_profiles(id) ON DELETE CASCADE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  reason          TEXT,
  created_by      UUID REFERENCES consultant_admin_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

-- ─── consultant_slots ─────────────────────────────────────
-- Generated time slots (regenerated on demand by admin)
CREATE TABLE IF NOT EXISTS consultant_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   UUID NOT NULL REFERENCES consultant_profiles(id) ON DELETE CASCADE,
  slot_date       DATE NOT NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  duration_mins   INTEGER NOT NULL,
  status          slot_status NOT NULL DEFAULT 'available',
  blocked_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(consultant_id, start_time)
);

CREATE INDEX IF NOT EXISTS idx_slots_date_status ON consultant_slots(slot_date, status);
CREATE INDEX IF NOT EXISTS idx_slots_consultant_date ON consultant_slots(consultant_id, slot_date);

-- ─── consultant_otp_verifications ─────────────────────────
CREATE TABLE IF NOT EXISTS consultant_otp_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT NOT NULL,
  otp_code        TEXT NOT NULL,
  session_id      UUID NOT NULL UNIQUE,
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  attempts        INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON consultant_otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_session ON consultant_otp_verifications(session_id);

-- ─── consultant_assessment_sessions ───────────────────────
CREATE TABLE IF NOT EXISTS consultant_assessment_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token     TEXT NOT NULL UNIQUE,
  phone             TEXT NOT NULL,
  full_name         TEXT,
  phone_verified    BOOLEAN NOT NULL DEFAULT false,
  -- body profile
  age               INTEGER,
  gender            TEXT,
  height_cm         NUMERIC(5,2),
  weight_kg         NUMERIC(5,2),
  target_weight_kg  NUMERIC(5,2),
  bmi               NUMERIC(4,2),
  -- assessment answers stored as JSONB
  barriers          JSONB DEFAULT '[]',
  lifestyle         JSONB DEFAULT '{}',
  digestive_health  JSONB DEFAULT '{}',
  medical_conditions JSONB DEFAULT '[]',
  eligibility       JSONB DEFAULT '{}',
  motivation        JSONB DEFAULT '{}',
  -- report
  report_generated  BOOLEAN NOT NULL DEFAULT false,
  report_data       JSONB,
  shopify_customer_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── consultant_bookings ──────────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id           UUID NOT NULL REFERENCES consultant_slots(id),
  session_id        UUID REFERENCES consultant_assessment_sessions(id),
  consultant_id     UUID NOT NULL REFERENCES consultant_profiles(id),
  phone             TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  email             TEXT,
  status            booking_status NOT NULL DEFAULT 'confirmed',
  booking_reference TEXT NOT NULL UNIQUE DEFAULT 'TOK-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)),
  notes             TEXT,
  cancelled_reason  TEXT,
  shopify_order_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_slot ON consultant_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON consultant_bookings(phone);

-- ─── Trigger: updated_at auto-update ──────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'consultant_admin_users',
    'consultant_profiles',
    'consultant_working_hours',
    'consultant_slots',
    'consultant_assessment_sessions',
    'consultant_bookings'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON %I;
       CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();', t, t);
  END LOOP;
END $$;

-- ─── Seed: default super_admin ────────────────────────────
-- Password: Admin@123 (bcrypt hash — change immediately in production)
INSERT INTO consultant_admin_users (email, password_hash, full_name, role)
VALUES (
  'admin@theobesitykiller.com',
  '$2b$12$Z9mg4gWUX2ZrPQqQKQXqGeMNLPm9ZOIm0j5HWgqDWOVpt2shkMHrm',
  'Super Admin',
  'super_admin'
) ON CONFLICT (email) DO NOTHING;

-- ─── Seed: default consultant ─────────────────────────────
INSERT INTO consultant_profiles (full_name, email, phone, specialization, timezone)
VALUES (
  'Dr. Priya Sharma',
  'priya@theobesitykiller.com',
  '+919876543210',
  'Bariatric & Metabolic Health',
  'Asia/Kolkata'
) ON CONFLICT (email) DO NOTHING;

-- Default working hours Mon–Sat 09:00–18:00, 30 min slots
INSERT INTO consultant_working_hours (consultant_id, day_of_week, start_time, end_time, slot_duration)
SELECT
  c.id,
  d::day_of_week,
  '09:00'::TIME,
  '18:00'::TIME,
  30
FROM consultant_profiles c,
     UNNEST(ARRAY['monday','tuesday','wednesday','thursday','friday','saturday']::day_of_week[]) d
WHERE c.email = 'priya@theobesitykiller.com'
ON CONFLICT (consultant_id, day_of_week) DO NOTHING;
