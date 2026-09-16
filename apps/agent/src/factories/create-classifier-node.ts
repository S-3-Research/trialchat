import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { AgentStateType } from "../state.js";
import { modelParams } from "../lib/model-params.js";

/**
 * Config for a classifier node — an LLM call constrained to one of a fixed
 * set of labels (via structured output) whose result is written to a single
 * state key (e.g. `intent`), not to `messages`.
 */
export type ClassifierConfig<TLabel extends string> = {
  model?: string;
  temperature?: number;
  systemPrompt: string;
  labels: readonly [TLabel, ...TLabel[]];
  stateKey: string;
};

export function createClassifierNode<TLabel extends string>(
  config: ClassifierConfig<TLabel>
) {
  const schema = z.object({
    label: z.enum(config.labels),
  });

  // The LangGraph API server's `messages` streamMode handler only
  // suppresses a chat-model call's token chunks when the *literal* tag
  // "nostream" is present on the run (see `on_chat_model_stream` handling
  // in `@langchain/langgraph-api`'s stream.mjs: `!event.tags?.includes(
  // "nostream")`). "langsmith:nostream" (the LangSmith trace-hiding
  // convention) is a *different* string and does not match this check —
  // that's why this classifier's raw JSON output kept leaking into the
  // chat UI as streamed text despite being tagged that way before. Bind
  // the correct tag at model-construction time via `withConfig` so it's
  // present on every underlying `on_chat_model_stream` event this model
  // emits, regardless of what's merged into `runConfig` per-invoke.
  const model = new ChatOpenAI(
    modelParams(config.model ?? "gpt-4o-mini", config.temperature ?? 0)
  )
    .withStructuredOutput(schema, { name: "classify" })
    .withConfig({ tags: ["nostream"] });

  return async function classifierNode(
    state: AgentStateType,
    runConfig: LangGraphRunnableConfig
  ) {
    const result = await model.invoke(
      [
        { role: "system", content: config.systemPrompt },
        ...state.messages,
      ],
      runConfig
    );

    // Only ever writes to `state[stateKey]` (e.g. `state.intent`), never to
    // `state.messages` — nothing here is meant to render as chat text.
    return { [config.stateKey]: result.label };
  };
}
