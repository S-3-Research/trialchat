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

  const model = new ChatOpenAI(
    modelParams(config.model ?? "gpt-4o-mini", config.temperature ?? 0)
  ).withStructuredOutput(schema, { name: "classify" });

  return async function classifierNode(
    state: AgentStateType,
    runConfig: LangGraphRunnableConfig
  ) {
    // Tagged "langsmith:nostream" so this internal classification call's
    // tokens are excluded from `streamMode: "messages"` — it never writes
    // to `state.messages`, so there's nothing user-facing to stream anyway,
    // but without the tag LangGraph still forwards its raw token chunks to
    // the frontend, which briefly flashes as assistant text. Merged into
    // (not replacing) the node's real `runConfig` — passing a bare
    // `{ tags: [...] }` literal drops the callbacks/metadata LangGraph
    // attaches to this run, which is what actually let the tag reach the
    // `StreamMessagesHandler` that decides whether to emit tokens.
    const result = await model.invoke(
      [
        { role: "system", content: config.systemPrompt },
        ...state.messages,
      ],
      {
        ...runConfig,
        tags: [...(runConfig.tags ?? []), "langsmith:nostream"],
      }
    );

    return { [config.stateKey]: result.label };
  };
}
