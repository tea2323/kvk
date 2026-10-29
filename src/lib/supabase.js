import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Supabase] ⚠️ Missing env vars.\n' +
    'Create a .env file in the project root with:\n' +
    '  VITE_SUPABASE_URL=https://...\n' +
    '  VITE_SUPABASE_ANON_KEY=...'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/*
  ── Required SQL (run once in Supabase → SQL Editor) ────────────────────────

  CREATE TABLE IF NOT EXISTS kvk_appointments (
    id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    player_name        TEXT        NOT NULL,
    alliance           TEXT        NOT NULL,
    selected_days      TEXT[]      NOT NULL DEFAULT '{}',   -- was kvk_days
    tc_level           TEXT        NOT NULL,
    construction_days  INTEGER     DEFAULT 0,
    construction_hours INTEGER     DEFAULT 0,
    research_days      INTEGER     DEFAULT 0,
    research_hours     INTEGER     DEFAULT 0,
    training_days      INTEGER     DEFAULT 0,
    training_hours     INTEGER     DEFAULT 0,
    true_gold_count    INTEGER     DEFAULT 0,               -- was true_gold
    time_slot_day1     TEXT,
    time_slot_day4     TEXT
    -- roi_score is computed client-side; not stored
  );

  ALTER TABLE kvk_appointments ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "public_insert" ON kvk_appointments
    FOR INSERT WITH CHECK (true);

  CREATE POLICY "public_select" ON kvk_appointments
    FOR SELECT USING (true);
*/
