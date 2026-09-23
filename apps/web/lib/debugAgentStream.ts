import type { unstable_createLangGraphStream } from "@assistant-ui/react-langgraph";

type AgentStream = ReturnType<typeof unstable_createLangGraphStream>;

function summarizeEvent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(summarizeEvent);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;

  // Put message identity first, including explicit nulls when absent. A
  // response_metadata.id is a provider response ID, not the accumulator key.
  if ("content" in record) {
    const blocks = Array.isArray(record.content) ? record.content : [];
    const text = typeof record.content === "string"
      ? record.content
      : blocks.map((block) => typeof block?.text === "string" ? block.text : "").join("");
    const response = record.response_metadata as Record<string, unknown> | undefined;
    return {
      messageId: record.id ?? null,
      messageType: record.type ?? null,
      role: record.role ?? null,
      textLength: text.length,
      textPreview: text.slice(0, 200),
      contentBlocks: blocks.map((block) => ({
        type: block?.type,
        id: block?.id,
        index: block?.index,
        textLength: typeof block?.text === "string" ? block.text.length : undefined,
      })),
      providerResponseId: response?.id,
      toolCallIds: Array.isArray(record.tool_calls)
        ? record.tool_calls.map((call) => call?.id)
        : undefined,
    };
  }

  return Object.fromEntries(Object.entries(record)
    .filter(([key]) => key !== "encrypted_content" && key !== "additional_kwargs" && key !== "response_metadata")
    .map(([key, child]) => [key, summarizeEvent(child)]));
}

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
          data: summarizeEvent(data),
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
