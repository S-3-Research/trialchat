-- =====================================================
-- Table: dev_test_runs
-- 记录 /trial-chat/dev-test 页面的历史测试运行结果
-- 来源：supabase-devtest-migration.sql
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

-- 索引（历史列表页按时间倒序展示）
CREATE INDEX IF NOT EXISTS idx_dev_test_runs_created_at
  ON dev_test_runs (created_at DESC);

-- RLS（内部调试工具数据，无最终用户访问，策略与其余表一致保持开放）
ALTER TABLE dev_test_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read dev_test_runs" ON dev_test_runs;
CREATE POLICY "Allow read dev_test_runs" ON dev_test_runs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert dev_test_runs" ON dev_test_runs;
CREATE POLICY "Allow insert dev_test_runs" ON dev_test_runs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete dev_test_runs" ON dev_test_runs;
CREATE POLICY "Allow delete dev_test_runs" ON dev_test_runs FOR DELETE USING (true);
