import type { unstable_createLangGraphStream } from "@assistant-ui/react-langgraph";

type AgentStream = ReturnType<typeof unstable_createLangGraphStream>;

// Opt in from the browser console; checked on each run, so no reload is needed.
// JSON strings capture the event at receipt time (DevTools object previews can
// otherwise show later mutations). The original events pass through unchanged.
export function debugAgentStream(stream: AgentStream): AgentStream {
  return async function* (messages, config) {
    let enabled = false;
    try {
      enabled = window.localStorage.getItem("trialchat:debug-stream") === "1";
    } catch {
      // Storage may be unavailable; diagnostics must not block the chat.
    }

    const run = enabled ? crypto.randomUUID() : "";
    const started = Date.now();
    let sequence = 0;
    const log = (event: string, data?: unknown) => {
      if (!enabled) return;
      try {
        console.log("[TrialChat stream] " + JSON.stringify({
          run,
          sequence: sequence++,
          elapsedMs: Date.now() - started,
          event,
          data,
        }));
      } catch {
        // Logging must never change stream behavior.
      }
    };

    log("debug:start");
    try {
      for await (const chunk of await stream(messages, config)) {
        log(chunk.event, chunk.data);
        yield chunk;
      }
      log("debug:end", { aborted: config.abortSignal.aborted });
    } catch (error) {
      log("debug:error", {
        message: error instanceof Error ? error.message : String(error),
        aborted: config.abortSignal.aborted,
      });
      throw error;
    }
  };
}
