-- =====================================================
-- Table: trialchat_link_events
-- 外部链接点击追踪表：记录所有经过 /r 中转的外部链接点击
-- 合并自：supabase-link-events-migration.sql
--        + supabase-link-events-is-test-migration.sql (is_test 字段)
--        + supabase-link-events-sms-migration.sql (sms url_type 支持)
-- 注：表名已由 link_events 重命名为 trialchat_link_events
-- =====================================================

CREATE TABLE IF NOT EXISTS trialchat_link_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url        TEXT        NOT NULL,
  url_type   TEXT        NOT NULL CHECK (url_type IN ('http', 'tel', 'mailto', 'sms')),
  meta       JSONB       NOT NULL DEFAULT '{}',
  is_test    BOOLEAN     NOT NULL DEFAULT FALSE,  -- ?test=true 触发的测试流量标记，便于分析时过滤
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 若表已存在于旧版本（缺少 is_test 列或 sms 尚未加入 url_type），补齐结构：
ALTER TABLE trialchat_link_events
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE trialchat_link_events DROP CONSTRAINT IF EXISTS trialchat_link_events_url_type_check;
ALTER TABLE trialchat_link_events
  ADD CONSTRAINT trialchat_link_events_url_type_check
  CHECK (url_type IN ('http', 'tel', 'mailto', 'sms'));

-- 从旧版 meta.is_test 回填新列（如果之前是存在 meta JSON 里）
UPDATE trialchat_link_events
SET is_test = TRUE
WHERE is_test = FALSE
  AND (meta ->> 'is_test') = 'true';

-- 索引
CREATE INDEX IF NOT EXISTS idx_trialchat_link_events_created_at ON trialchat_link_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trialchat_link_events_url        ON trialchat_link_events (url);
CREATE INDEX IF NOT EXISTS idx_trialchat_link_events_url_type   ON trialchat_link_events (url_type);
CREATE INDEX IF NOT EXISTS idx_trialchat_link_events_meta       ON trialchat_link_events USING GIN (meta);
CREATE INDEX IF NOT EXISTS idx_trialchat_link_events_is_test    ON trialchat_link_events (is_test);

-- RLS
ALTER TABLE trialchat_link_events ENABLE ROW LEVEL SECURITY;

-- 匿名/访客也需要能够写入点击追踪事件
DROP POLICY IF EXISTS "Anyone can insert link events" ON trialchat_link_events;
CREATE POLICY "Anyone can insert link events"
  ON trialchat_link_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read link events" ON trialchat_link_events;
CREATE POLICY "Anyone can read link events"
  ON trialchat_link_events FOR SELECT USING (true);

