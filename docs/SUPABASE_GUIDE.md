# Supabase integration

Supabase stores web business data separately from LangGraph's thread/checkpoint
persistence. Configure `NEXT_PUBLIC_SUPABASE_URL` and the server-only
`SUPABASE_SECRET_KEY` on the web app; see `apps/web/.env.example`.

## Active features

- Link tracking: `/api/track-link` writes `trialchat_link_events`.
- Administration: `/api/link-events` and `/api/link-events/export` require
  `ADMIN_PASSWORD`; see `supabase-trialchat-link-events.sql`.
- Profile and intake migration endpoints are retained, but signed-in profile
  access is unavailable until an authentication mechanism is restored.
- Current guest chat preferences are stored in the browser.

The server secret bypasses RLS, so authorization must be enforced in API routes.

## Retired features

The old ChatKit tools API, session test runner and test-history API were removed.
New installations do not need the former `dev_test_runs` table. Existing records
are left untouched; there is no data deletion or migration in this cleanup.

Chat messages and Trial Panel state are read through the LangGraph Threads API,
not the legacy Supabase conversation tables. Supplying an agent `DATABASE_URL`
does not redirect managed LangGraph Cloud persistence into this Supabase project.
