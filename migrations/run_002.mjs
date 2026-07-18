import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const queries = [
  `ALTER TABLE consultant_assessment_sessions ALTER COLUMN phone DROP NOT NULL;`,
  `ALTER TABLE consultant_otp_verifications ADD COLUMN IF NOT EXISTS otp_hash TEXT;`,
  `ALTER TABLE consultant_otp_verifications ADD COLUMN IF NOT EXISTS resent_at TIMESTAMPTZ;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_booking_per_slot ON consultant_bookings(slot_id) WHERE status IN ('pending', 'confirmed');`,
  `CREATE INDEX IF NOT EXISTS idx_slots_future_available ON consultant_slots(consultant_id, start_time) WHERE status = 'available' AND start_time > NOW();`,
];

async function run() {
  for (const q of queries) {
    const { error } = await supabase.rpc('exec_sql', { query: q });
    if (error) {
      console.log('FAIL:', q.substring(0, 80), error.message);
    } else {
      console.log('OK:', q.substring(0, 80));
    }
  }
}
run();
