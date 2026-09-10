-- =====================================================
-- link_events.is_test migration
-- Adds a real boolean column to flag test-mode traffic
-- (triggered via ?test=true on the frontend), so it can
-- be filtered out of production analytics efficiently.
-- =====================================================

ALTER TABLE link_events
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill from existing meta.is_test values (if any were stored there
-- before this column existed).
UPDATE link_events
SET is_test = TRUE
WHERE is_test = FALSE
  AND (meta ->> 'is_test') = 'true';

-- Index to make "exclude test" queries fast on large tables.
CREATE INDEX IF NOT EXISTS idx_link_events_is_test ON link_events (is_test);
