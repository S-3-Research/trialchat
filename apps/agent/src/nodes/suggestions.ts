import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { typedUi } from "@langchain/langgraph-sdk/react-ui/server";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { AgentStateType } from "../state.js";
import { suggestionsConfig } from "../configs/suggestions.config.js";
import { modelParams } from "../lib/model-params.js";

/**
 * Structured-output node: reads the full conversation and pushes a
 * Generative UI message (via `typedUi(config).push(...)`, see
 * `@langchain/langgraph-sdk/react-ui/server`) carrying the follow-up
 * prompts, instead of writing them to a plain state field. The UI message
 * is bound to the branch's assistant reply (`message: { id: lastAiMessage
 * .id }`) so the frontend renders it attached to that specific message —
 * see apps/web/components/assistant-ui/thread.tsx's `renderers.suggestions`
 * for the corresponding React component, registered via
 * `useLangGraphRuntime({ uiComponents: { renderers: {...} } })` in
 * AssistantPanel.tsx.
 *
 * This mirrors how the old ChatKit/Agent Builder workflow returned widget
 * payloads (`{ widget: { name, state } }`) from a tool/node — `typedUi`'s
 * `.push({ name, props })` is the LangGraph.js equivalent: a node
 * explicitly emitting a named, props-carrying UI message rather than
 * relying on the frontend to reconstruct one from raw state.
 */
const schema = z.object({
  suggestions: z.array(z.string()).max(suggestionsConfig.maxSuggestions),
});

const model = new ChatOpenAI(
  modelParams(suggestionsConfig.model, suggestionsConfig.temperature)
).withStructuredOutput(schema, { name: "suggestions" });

export async function suggestionsAgent(
  state: AgentStateType,
  config: LangGraphRunnableConfig
) {
  // Tagged "langsmith:nostream" for the same reason as the classifier node
  // (see create-classifier-node.ts) — this call's output is pushed as a
  // structured UI message below, not streamed as chat text. Merged into
  // (not replacing) `config` so callbacks/metadata LangGraph attaches to
  // this run are preserved — a bare `{ tags: [...] }` literal drops them,
  // which is why the tag wasn't actually suppressing the stream before.
  const result = await model.invoke(
    [
      { role: "system", content: suggestionsConfig.systemPrompt },
      ...state.messages,
    ],
    {
      ...config,
      tags: [...(config.tags ?? []), "langsmith:nostream"],
    }
  );

  // The branch node (knowledge / api_agent / other_questions) always ends
  // with the assistant's final reply as the last message by the time this
  // node runs (see graph.ts) — bind the UI message to it.
  const lastMessage = state.messages.at(-1);

  const ui = typedUi<{ suggestions: SuggestionsWidgetComponent }>(config);
  ui.push(
    { name: "suggestions", props: { suggestions: result.suggestions } },
    lastMessage?.id ? { message: { id: lastMessage.id } } : undefined
  );

  return {};
}

/**
 * `typedUi`'s generic maps a UI message `name` to the *component* that
 * renders it (see apps/web/components/assistant-ui/tool-ui.tsx's
 * `SuggestionsWidget`), purely so it can infer the `props` shape at the
 * call site above via `ComponentPropsWithoutRef`. This package has no React
 * dependency, so this is a minimal structural stand-in — never called, its
 * signature just has to be assignable to React's `ElementType`.
 */
type SuggestionsWidgetProps = { suggestions: string[] };
type SuggestionsWidgetComponent = (props: SuggestionsWidgetProps) => null;

