-- =====================================================
-- Dev Test Runs Table
-- Run this in Supabase SQL Editor to add history support
-- =====================================================

CREATE TABLE IF NOT EXISTS dev_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Run metadata
  dataset_name TEXT NOT NULL,
  dataset_id   TEXT NOT NULL,
  workflow_id  TEXT NOT NULL,
  workflow_name TEXT,          -- matched from WORKFLOW_PRESETS if available

  -- Aggregate stats
  total_tests        INTEGER NOT NULL DEFAULT 0,
  passed_tests       INTEGER NOT NULL DEFAULT 0,
  failed_tests       INTEGER NOT NULL DEFAULT 0,
  avg_rating         FLOAT,   -- null when no ratings given
  hallucination_count INTEGER NOT NULL DEFAULT 0,
  widget_count       INTEGER NOT NULL DEFAULT 0,

  -- Full results payload (conversations + per-case meta)
  results JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for the history page (newest first)
CREATE INDEX IF NOT EXISTS idx_dev_test_runs_created_at
  ON dev_test_runs (created_at DESC);

-- RLS (same open policy as the rest of the schema)
ALTER TABLE dev_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read dev_test_runs"   ON dev_test_runs FOR SELECT USING (true);
CREATE POLICY "Allow insert dev_test_runs" ON dev_test_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow delete dev_test_runs" ON dev_test_runs FOR DELETE USING (true);
