# Acadia TrialChat

A clinical-trial assistant built with Next.js, assistant-ui and a LangGraph.js agent.

## Applications

- `apps/web`: landing page, chat, Trial Panel, bookmarks, preferences and web API routes.
- `apps/agent`: intent routing, model calls, trial search, knowledge tools and follow-up suggestions.
- `packages/shared-types`: shared schemas and types.

## Local development

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
cp apps/agent/.env.example apps/agent/.env.local
```

Fill in the per-app environment files, then run `npm run dev` or `docker compose up`.
The web app runs on http://localhost:3000 and the agent on http://localhost:2024.
The root `.env.example` is a guide, not a runtime configuration file.

Docker Compose injects the service URLs automatically. Its agent runs the development
server; this is not a production Agent Server deployment. See the per-app examples
for database configuration and the distinction between application checkpointers
and server-managed persistence.

## Deployment

Deploy web and agent independently. For a hosted web app talking to LangGraph Cloud:

- Set `LANGGRAPH_API_URL` and `LANGGRAPH_API_KEY` on **web**.
- Configure model/tool credentials on **agent**. Omit its application `DATABASE_URL`
  for managed Cloud persistence.
- Web Supabase credentials configure separate business data, not graph checkpoints.
- `NEXT_PUBLIC_*` settings are browser-visible build-time values.

## Routes

- `/`: landing page
- `/chat`: the sole chat runtime (LangGraph + assistant-ui)
- `/bookmarks`, `/settings`, `/personalization`, `/docs`, `/updates`
- `/admin`: link-event administration
- `/voice-test`: password-gated voice comparison tool

The old `/trial-chat` public URLs and chat-v2 URLs redirect to the new routes,
retaining query parameters. The legacy chat runtime, session test runner, test
history and their APIs have been removed. Existing database records are not deleted.
The `?test=true` analytics flag and voice-test authentication remain supported.
Browser storage keys for guest identity and appearance retain their previous names
so existing conversations and preferences remain accessible.

## Validation

```bash
npm test --workspace=apps/web
npm run build:web
npm run build:agent
```

Starter prompts and greeting text live in `apps/web/lib/config.ts`;
the chat runtime is configured in `apps/web/components/AssistantPanel.tsx`.

## Adding a new agent tool (LangGraph + assistant-ui)

The LangGraph-based chat UI (`/chat`, built on
`@assistant-ui/react` + `@assistant-ui/react-langgraph`) supports model tool
calls end-to-end, with a custom React component per tool for rendering
searching/result/error states inline in the thread. This section uses the
`get_trials` clinical-trial-search tool as a worked example; follow the same
four steps to add a new one.

### 1. Define the tool on the agent (`apps/agent`)

Every capability the agent can use — internal knowledge base, web search,
our own APIs — is an `AgentTool` (see
[apps/agent/src/tools/registry.ts](apps/agent/src/tools/registry.ts)): a
plain function tool we implement and execute ourselves, built with a zod
schema + an `execute()`, e.g.
[apps/agent/src/tools/trial-search.tool.ts](apps/agent/src/tools/trial-search.tool.ts):

```ts
export const trialSearchTool: AgentTool<TrialSearchArgs> = {
  name: "trial_search",
  description: "Search for clinical trials matching patient criteria...",
  schema: trialSearchSchema, // zod object — becomes the model-visible args schema
  execute: searchTrials, // calls the API, a DB, etc.
};
```

This is deliberately the *only* flavor of `AgentTool` — even capabilities
backed by an OpenAI-hosted feature under the hood (like
[knowledge-base.tool.ts](apps/agent/src/tools/knowledge-base.tool.ts)'s
`client.vectorStores.search()`, or
[web-search.tool.ts](apps/agent/src/tools/web-search.tool.ts)'s standalone
`client.responses.create({ tools: [{ type: "web_search" }] })` call) are
wrapped this way rather than passed straight to the agent's main chat model
as an OpenAI Responses API tool. Passing a hosted tool straight to the
model was tried and reverted: OpenAI resolves those server-side inside the
main model call, so they never show up as a standard tool_call, and the
assistant-ui version in this repo doesn't render their raw
`additional_kwargs.tool_outputs` shape. Wrapping everything as a plain
function tool means every tool call/result round-trips through the exact
same tool_call/ToolMessage protocol, which assistant-ui *does* render.

Keep `execute()`'s return value **JSON-serializable and flat** — normalize
any nested/awkward upstream API response into the shape your UI component
wants to render (see `flattenTrial()` in `trial-search.tool.ts`), rather
than pushing that mapping into the frontend.

Register the new tool in `tools` (and optionally a `toolPresets` bundle) in
[registry.ts](apps/agent/src/tools/registry.ts), then list it under
whichever node config(s) should have access to it — e.g.
[apps/agent/src/configs/api-agent.config.ts](apps/agent/src/configs/api-agent.config.ts)'s
`tools: toolPresets.trialMatching`. `createAgentNode`
([apps/agent/src/factories/create-agent-node.ts](apps/agent/src/factories/create-agent-node.ts))
binds those tools to the model and drives the call/execute/respond loop
itself. No `graph.ts` changes are needed per tool, only per new *node*.

Finally, mention the tool and any hard rules (e.g. "never invent a result,
only report what the tool returned") in the node's `prompt` (e.g.
[apps/agent/src/prompts/system.ts](apps/agent/src/prompts/system.ts) for
`api_agent`) — models are much less likely to call (or correctly rely on) a
tool that isn't described in the prompt.

### 2. Enable the tool's UI on the frontend (`apps/web`)

Tool-call rendering is configured per-message in
[apps/web/components/assistant-ui/thread.tsx](apps/web/components/assistant-ui/thread.tsx),
inside `AssistantMessage`:

```tsx
<MessagePrimitive.Content
  components={{
    Text: MarkdownText,
    tools: {
      by_name: { get_trials: GetTrialsToolUI }, // enable: map tool name -> component
      Fallback: ToolCallFallback,               // any tool not in by_name renders here
    },
  }}
/>
```

- **Enable** a tool's custom UI by adding a `toolName: Component` entry to
  `by_name`.
- **Disable** a tool's custom UI (fall back to the generic renderer) by
  removing its entry from `by_name` — it will then render via `Fallback`
  instead of a bespoke component. There's no separate "off switch"; `by_name`
  is the allowlist.
- If you want a tool call to render nothing at all, map it to a component
  that returns `null`.

### 3. Write the tool-call UI component

Tool-call components are plain
`ToolCallMessagePartComponent<TArgs, TResult>` components — see
[apps/web/components/assistant-ui/tool-ui.tsx](apps/web/components/assistant-ui/tool-ui.tsx)'s
`GetTrialsToolUI` for the full example. They receive `args`, `status`, and
`result` as props and are expected to branch on `status.type`:

```tsx
export const GetTrialsToolUI: ToolCallMessagePartComponent<
  GetTrialsArgs,
  GetTrialsResult
> = ({ args, status, result: rawResult }) => {
  if (status.type === "running" || status.type === "requires-action") {
    return <SearchingState args={args ?? {}} />;     // 调用中 / 等待中
  }

  // LangGraph's ToolNode serializes non-string tool results to a JSON
  // string before they reach the wire; @assistant-ui/react-langgraph passes
  // that string through as `result` unchanged — parse it back into an object.
  const result =
    typeof rawResult === "string" ? safeJsonParse(rawResult) : rawResult;

  if (status.type === "incomplete" || result?.success === false) {
    return <ErrorState message={result?.error ?? "..."} />; // 出错
  }

  const trials = result?.trials ?? [];
  if (trials.length === 0) {
    return <EmptyState />;                              // 成功但无结果
  }

  return <ResultList trials={trials} />;                // 成功且有结果
};
```

`status.type` is one of `"running"`, `"requires-action"`, `"complete"`, or
`"incomplete"` (see `ToolCallMessagePartStatus` from `@assistant-ui/react`).
**Important:** always parse `result` defensively before reading its fields —
`@assistant-ui/react-langgraph` forwards whatever `ToolMessage.content`
LangGraph produced, which is a JSON **string**, not an object, for any tool
that doesn't return a plain string.

### 4. Verify end-to-end

- Call the agent API directly to confirm the tool's return shape without any
  frontend involved:
  ```bash
  curl -s -X POST http://localhost:2024/runs/wait \
    -H "Content-Type: application/json" \
    -d '{"assistant_id":"<id from /assistants/search>","input":{"messages":[{"role":"user","content":"Find Alzheimers trials in SF"}]}}' \
    | python3 -m json.tool
  ```
  Look for a `"type": "tool"` message in the response — its `content` is the
  JSON string your `by_name` component will need to parse.
- Then exercise it through the real UI at `/chat` to confirm
  the searching/result/error states all render as expected.
- After changing `apps/agent/src/**` or `apps/web/components/**` source
  files only (no new npm dependency), Docker Compose hot-reloads both dev
  servers automatically — no rebuild needed. A rebuild
  (`docker compose up -d --build <service>`) is only required after editing
  a `package.json` / installing a new package, since `node_modules` lives in
  a named volume that isn't refreshed by the source bind mount.
