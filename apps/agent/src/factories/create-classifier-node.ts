import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { AgentStateType } from "../state.js";

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

  const model = new ChatOpenAI({
    model: config.model ?? "gpt-4o-mini",
    temperature: config.temperature ?? 0,
  }).withStructuredOutput(schema, { name: "classify" });

  return async function classifierNode(state: AgentStateType) {
    const result = await model.invoke([
      { role: "system", content: config.systemPrompt },
      ...state.messages,
    ]);

    return { [config.stateKey]: result.label };
  };
}
