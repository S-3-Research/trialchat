-- =====================================================
-- link_events: add 'sms' as a supported url_type
-- Run this against an existing database that already has
-- the link_events table created via supabase-link-events-migration.sql
-- =====================================================

ALTER TABLE link_events DROP CONSTRAINT IF EXISTS link_events_url_type_check;

ALTER TABLE link_events
  ADD CONSTRAINT link_events_url_type_check
  CHECK (url_type IN ('http', 'tel', 'mailto', 'sms'));
