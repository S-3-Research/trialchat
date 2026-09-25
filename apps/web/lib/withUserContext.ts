import type { unstable_createLangGraphStream } from "@assistant-ui/react-langgraph";

type AgentStream = ReturnType<typeof unstable_createLangGraphStream>;

/**
 * Merges a `userContext` object into every run's `config.state`, so it
 * rides along in the graph's `input` (see
 * `unstable_createLangGraphStream`'s `input: { ...config.state, ... }`
 * construction) — starting with the very first run of a brand-new thread.
 *
 * This replaces the `IntakeContextBridge` + `useLangGraphSetState`
 * approach for `userContext` specifically: `useLangGraphSetState` reads
 * `useAui()`'s *currently active* thread, which isn't backed by this
 * `useLangGraphRuntime` instance yet for a just-created thread (no
 * `remoteId`/checkpoint attached server-side) — hence the "current thread
 * is not backed by the useLangGraphRuntime runtime" error when called
 * too early. Wrapping the plain `stream` callback instead sidesteps that
 * entirely: it's just a function call, not a hook, so it works
 * regardless of thread/runtime attachment state.
 *
 * `getUserContext` is invoked fresh on every run (not memoized), so it
 * always reflects the latest intake data — e.g. right after
 * IntakeFormModal completes, or after a clinician exits clinician mode —
 * without needing to recreate `stream`.
 *
 * Merges alongside (never replaces) whatever else is already staged in
 * `config.state` by other bridges (e.g. TrialSearchChatBridge's
 * `activeTrialSearch`, staged via `useLangGraphSetState` once the thread
 * *is* attached).
 */
export function withUserContext(
  stream: AgentStream,
  getUserContext: () => Record<string, unknown> | null | undefined
): AgentStream {
  return async function* (messages, config) {
    const userContext = getUserContext();
    const nextConfig =
      userContext && Object.keys(userContext).length > 0
        ? { ...config, state: { ...config.state, userContext } }
        : config;
    yield* stream(messages, nextConfig);
  };
}
