-- =====================================================
-- link_events table migration
-- Tracks all external link clicks routed through /r
-- =====================================================

CREATE TABLE IF NOT EXISTS link_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url        TEXT        NOT NULL,
  url_type   TEXT        NOT NULL CHECK (url_type IN ('http', 'tel', 'mailto', 'sms')),
  meta       JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for time-based queries (dashboard) and URL dedup
CREATE INDEX IF NOT EXISTS idx_link_events_created_at ON link_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_events_url        ON link_events (url);
CREATE INDEX IF NOT EXISTS idx_link_events_url_type   ON link_events (url_type);
CREATE INDEX IF NOT EXISTS idx_link_events_meta       ON link_events USING GIN (meta);

-- RLS
ALTER TABLE link_events ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous / guest) can insert — needed for unauthenticated click tracking
DROP POLICY IF EXISTS "Anyone can insert link events" ON link_events;
CREATE POLICY "Anyone can insert link events"
  ON link_events FOR INSERT WITH CHECK (true);

-- Readable via API layer (consistent with rest of schema — auth enforced in route handlers)
DROP POLICY IF EXISTS "Anyone can read link events" ON link_events;
CREATE POLICY "Anyone can read link events"
  ON link_events FOR SELECT USING (true);
