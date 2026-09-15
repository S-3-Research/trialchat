import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { AgentStateType } from "../state.js";
import { suggestionsConfig } from "../configs/suggestions.config.js";

/**
 * Structured-output node: reads the full conversation and writes follow-up
 * prompts to `state.suggestions` (not `state.messages`) for the UI to render.
 */
const schema = z.object({
  suggestions: z.array(z.string()).max(suggestionsConfig.maxSuggestions),
});

const model = new ChatOpenAI({
  model: suggestionsConfig.model,
  temperature: suggestionsConfig.temperature,
}).withStructuredOutput(schema, { name: "suggestions" });

export async function suggestionsAgent(state: AgentStateType) {
  const result = await model.invoke([
    { role: "system", content: suggestionsConfig.systemPrompt },
    ...state.messages,
  ]);

  return { suggestions: result.suggestions };
}
