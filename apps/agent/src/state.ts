import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import {
  uiMessageReducer,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui/server";
import type { ActiveTrialSearchContext } from "./types/active-trial-search.js";

export type Intent = "knowledge" | "trial_matching" | "other";

/**
 * Shared graph state for the Trial Chat agent.
 *
 * Spreads the prebuilt `MessagesAnnotation` for the `messages` key so the
 * generated JSON schema properly reflects the full Human/AI/System/Tool
 * message union — required for LangGraph Studio's chat view to recognize
 * this as a standard chat-compatible graph (a hand-rolled
 * `Annotation<BaseMessage[]>` loses that union in the generated schema).
 *
 * Every node reads/writes this single shared object; a node only needs to
 * return the keys it wants to update (e.g. `{ intent: "knowledge" }`) — the
 * reducers below take care of merging that into the running state.
 */
export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  // Free-form context passed in from the web app at session start
  // (e.g. intake answers: role, response_style, intent).
  userContext: Annotation<Record<string, unknown>>({
    reducer: (_left, right) => right,
    default: () => ({}),
  }),
  // Written by `intention` node; read by graph.ts's conditional edge to
  // route to `knowledge` | `api_agent` | `other_questions`.
  intent: Annotation<Intent | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
  // Written by `suggestions_agent` via `typedUi(config).push(...)` (see
  // apps/agent/src/nodes/suggestions.ts) — Generative UI messages, each
  // bound (via `metadata.id`) to the assistant message they're follow-ups
  // for. `uiMessageReducer` handles both "ui" (upsert) and "remove-ui"
  // events, dropping removed entries — so the channel's *state* type is
  // always a plain `UIMessage[]`, even though updates written to it can be
  // a `RemoveUIMessage`. assistant-ui's `useLangGraphRuntime` reads this
  // list directly off the live stream, and the web app's thread-reload
  // `load` callback reads it back out of `state.values.ui` for persistence
  // across reloads.
  ui: Annotation<UIMessage[], UIMessage | RemoveUIMessage | (UIMessage | RemoveUIMessage)[]>({
    reducer: uiMessageReducer,
    default: () => [],
  }),
  // Reserved for future intake/profile data (e.g. condition, location, age)
  // once it's threaded through from the web app rather than inferred by
  // the model from chat history alone.
  userProfile: Annotation<Record<string, unknown> | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
  // Reserved for the `api_agent` branch to cache the last `get_trials`
  // result for downstream nodes (e.g. `suggestions`) without re-parsing it
  // out of `messages`.
  trialResults: Annotation<unknown[] | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
  // Staged by the web app via `useLangGraphSetState` whenever the shared
  // Trial Panel state (contexts/TrialSearchContext.tsx) changes — see
  // TrialSearchChatBridge.tsx. Last-write-wins: each run only cares about
  // the *current* search, not a history of past values, so unlike
  // `messages` this never accumulates across turns. Read by
  // `createAgentNode` (factories/create-agent-node.ts) and spliced into
  // the model's input as a context message when
  // `config.includeActiveTrialSearchContext` is set, without ever being
  // written back into `state.messages` — so it can carry the *full*
  // criteria/results/selected-trial payload every turn without the
  // conversation's persisted message history growing.
  activeTrialSearch: Annotation<ActiveTrialSearchContext | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
});

export type AgentStateType = typeof AgentState.State;
