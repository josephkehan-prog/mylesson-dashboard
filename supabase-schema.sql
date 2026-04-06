-- ============================================================
-- Nexterra Student Portal — Supabase Schema
-- Replaces Google Sheets / Apps Script backend
-- ============================================================
-- Run this in Supabase SQL Editor after creating your project.
-- After running:
--   1. Copy your project URL (Settings → API → Project URL)
--   2. Copy your anon key (Settings → API → anon public)
--   3. Paste both into nexterra_student.html CONFIG.supabase
-- ============================================================

-- SUBMISSIONS: one row per student test submission
CREATE TABLE IF NOT EXISTS submissions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  student       text        NOT NULL,
  class_code    text,
  lesson        text,
  lesson_id     text,
  score         text,
  correct       integer,
  total         integer,
  percent       numeric,
  time_taken    text,
  answers       jsonb,
  notes         text,
  submitted_at  timestamptz DEFAULT now()
);

-- REOPENS: one row per teacher reopen action
CREATE TABLE IF NOT EXISTS reopens (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  student       text,
  lesson        text,
  class_code    text,
  reopened_by   text,
  reopened_at   timestamptz DEFAULT now()
);

-- LOGINS: one row per student session (new tracking — was not in Google Sheets)
CREATE TABLE IF NOT EXISTS logins (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  student       text,
  class_code    text,
  login_type    text,          -- 'session'
  logged_in_at  timestamptz DEFAULT now()
);

-- ── Row Level Security ──────────────────────────────────────
-- Allow anonymous users (students/teachers using the app) to
-- INSERT and SELECT on all three tables. No UPDATE or DELETE
-- allowed — submissions are append-only.

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_submissions" ON submissions;
DROP POLICY IF EXISTS "anon_select_submissions" ON submissions;
CREATE POLICY "anon_insert_submissions" ON submissions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_submissions" ON submissions
  FOR SELECT USING (true);

ALTER TABLE reopens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_reopens" ON reopens;
DROP POLICY IF EXISTS "anon_select_reopens" ON reopens;
CREATE POLICY "anon_insert_reopens" ON reopens
  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_reopens" ON reopens
  FOR SELECT USING (true);

ALTER TABLE logins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_logins" ON logins;
DROP POLICY IF EXISTS "anon_select_logins" ON logins;
CREATE POLICY "anon_insert_logins" ON logins
  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_logins" ON logins
  FOR SELECT USING (true);

-- ── Indexes for common query patterns ───────────────────────
CREATE INDEX IF NOT EXISTS idx_submissions_class     ON submissions (class_code);
CREATE INDEX IF NOT EXISTS idx_submissions_student   ON submissions (student);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted ON submissions (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reopens_student       ON reopens (student);
CREATE INDEX IF NOT EXISTS idx_logins_student        ON logins (student, logged_in_at DESC);
