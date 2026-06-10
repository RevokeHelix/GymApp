-- Run this in Supabase Dashboard → SQL Editor

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name       TEXT,
  weight     NUMERIC,
  height     NUMERIC,
  age        INTEGER,
  goal       TEXT        DEFAULT 'Build Muscle',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profile_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profile_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── Workouts ─────────────────────────────────────────────────────────────────
-- exercises stored as JSONB: [{ name, sets: [{ reps, weight }] }]
CREATE TABLE IF NOT EXISTS workouts (
  id         UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT        NOT NULL,
  date       TIMESTAMPTZ DEFAULT NOW(),
  exercises  JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workouts_all" ON workouts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── User Templates ───────────────────────────────────────────────────────────
-- exercises stored as JSONB: [{ name, sets, reps }]
CREATE TABLE IF NOT EXISTS user_templates (
  id         UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT        NOT NULL,
  program    TEXT        DEFAULT 'Custom',
  focus      TEXT        DEFAULT '',
  color      TEXT        DEFAULT '#f97316',
  exercises  JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_all" ON user_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Weight Entries ──────────────────────────────────────────────────────────
-- One entry per user per day; weight in kg
CREATE TABLE IF NOT EXISTS weight_entries (
  id         UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date       DATE        NOT NULL,
  weight     NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weight_all" ON weight_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Clean up any previous trigger (profile is created by app code instead) ──
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
