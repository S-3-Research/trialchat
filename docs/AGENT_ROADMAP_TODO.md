# Trial Chat — Agent Roadmap TODO

Tracking doc for the 4-part plan (persistence, thread history UI, auto
titles, LangSmith tracing). Update checkboxes as work lands; keep notes
short — this is a working log, not user-facing docs.

## ✅ 1. Thread/state persistence (Postgres checkpointer)

- [x] `apps/agent/src/checkpointer.ts` — `PostgresSaver` when `DATABASE_URL`
      is set, falls back to `MemorySaver` otherwise.
- [x] `apps/agent/src/graph.ts` — `graph` is now an async factory so the
      checkpointer can connect/migrate before compiling.
- [x] `docker-compose.yml` — enabled `postgres` service, `agent` depends on
      it and gets `DATABASE_URL` injected.
- [x] `apps/agent/.env.example` / `.env.local` — documented `DATABASE_URL`.
- [x] README — host-mode (Option B) instructions for starting a local
      Postgres container manually.
- [x] Verified: create thread → converse → restart dev server process →
      thread state + `threads.search()` listing both survive.

Local dev Postgres container already running outside docker-compose:
`acadia-agent-postgres` (port 5433, `restart unless-stopped`, volume
`acadia_agent_pgdata`). Docker Desktop was not running as of last check —
start it before `docker compose up` if that dev flow is needed.

## ✅ 2. New Chat / history sidebar (assistant-ui native primitives)

- [x] `apps/web/lib/threadListAdapter.ts` — `RemoteThreadListAdapter` over
      `client.threads.*` (LangGraph SDK), threads scoped by
      `metadata.userId` (guest id from `lib/guestId.ts`).
- [x] `apps/web/components/assistant-ui/ThreadListSidebar.tsx` — New Chat
      button + history list via `ThreadListPrimitive` /
      `ThreadListItemPrimitive`.
- [x] `apps/web/components/AssistantPanel.tsx` — wired
      `unstable_threadListAdapter`; desktop persistent sidebar, mobile
      drawer (`useIsMobile`).
- [x] Verified via curl against the real `/api/agent/*` proxy: create
      (with `metadata.userId`) → search/list scoped by userId → rename →
      archive → delete all behave as expected.

## ✅ 3. Auto-generated thread titles

- [x] `apps/web/app/api/threads/title/route.ts` — standalone route, calls
      OpenAI (gpt-4o-mini) directly (NOT through the agent graph) so title
      gen can't block/interfere with tool-calling loop.
- [x] `threadListAdapter.generateTitle` streams the title back per the
      `RemoteThreadListAdapter` contract and persists it to
      `metadata.title` via `client.threads.update`.
- [x] Verified: real OpenAI call returns e.g. "Alzheimer's Clinical Trials
      in California" for a sample user message.

## ⬜ 4. LangSmith tracing wired to threads (NOT STARTED)

- [ ] Confirm `LANGSMITH_TRACING` / `LANGSMITH_API_KEY` / `LANGSMITH_PROJECT`
      are passed through in all real environments (Docker Compose already
      via `apps/agent/.env.local`; double-check prod deployment / hosting
      config, not just local `.env.local`).
- [ ] In `apps/agent/src/nodes/callModel.ts`, pass `RunnableConfig`
      `tags`/`metadata` (e.g. `{ thread_id, langgraph_node: "callModel" }`)
      into the model call so LangSmith traces are filterable by thread_id.
- [ ] (Optional) Capture the LangSmith `run_id` from the model call and
      write it back to thread `metadata` so the web admin UI can deep-link
      to the trace for a given conversation.
- [ ] Decide whether title-generation calls (`/api/threads/title`, a
      separate OpenAI client, not LangChain) should also get LangSmith
      tracing — currently they do NOT go through LangChain so they will
      not show up in LangSmith at all unless we switch that route to use
      `@langchain/openai`'s `ChatOpenAI` instead of the raw `openai` SDK.

## Known pre-existing issues (unrelated to this work, left as-is)

- `apps/web/hooks/useVoiceInput.ts` — `tsc`/`next build` type error:
  duplicate `SpeechRecognition` / `webkitSpeechRecognition` global
  declarations with mismatched modifiers. Blocks a clean `next build`.
- `apps/web/lib/types/prompts.ts` — `ChatStarterPrompt.prompt` typed as
  `string` but some starter prompts pass `UserMessageContent[]`.
- `apps/web/components/Header.tsx` — unused `SIGN_IN_ENABLED` var
  (ESLint warning only).
