import { AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { AgentStateType } from "../state.js";
import { SYSTEM_PROMPT } from "../prompts/system.js";
import { tools } from "../tools/index.js";

/**
 * LLM-calling node with tool-calling enabled (e.g. clinical trial search).
 * When the model emits tool calls, the graph routes to the `tools` node
 * (see graph.ts) and loops back here with the tool results appended.
 */
const model = new ChatOpenAI({
  model: process.env.AGENT_MODEL ?? "gpt-4o-mini",
  temperature: 0.3,
}).bindTools(tools);

export async function callModel(state: AgentStateType) {
  const response = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    ...state.messages,
  ]);

  return { messages: [response as AIMessage] };
}
