import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

/*
  ── Required Supabase SQL (run once in the Supabase SQL Editor) ──────────────

  CREATE TABLE IF NOT EXISTS kvk_appointments (
    id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    player_name        TEXT        NOT NULL,
    alliance           TEXT        NOT NULL,
    kvk_days           TEXT[]      NOT NULL DEFAULT '{}',
    tc_level           TEXT        NOT NULL,
    construction_days  INTEGER     DEFAULT 0,
    construction_hours INTEGER     DEFAULT 0,
    research_days      INTEGER     DEFAULT 0,
    research_hours     INTEGER     DEFAULT 0,
    training_days      INTEGER     DEFAULT 0,
    training_hours     INTEGER     DEFAULT 0,
    true_gold          INTEGER     DEFAULT 0,
    time_slot_day1     TEXT,
    time_slot_day4     TEXT,
    roi_score          INTEGER     DEFAULT 0
  );

  ALTER TABLE kvk_appointments ENABLE ROW LEVEL SECURITY;

  -- Allow the booking form (anon) to insert
  CREATE POLICY "public_insert" ON kvk_appointments
    FOR INSERT WITH CHECK (true);

  -- Allow the admin dashboard (anon) to read
  CREATE POLICY "public_select" ON kvk_appointments
    FOR SELECT USING (true);
*/
