import { AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { AgentStateType } from "../state.js";
import { SYSTEM_PROMPT } from "../prompts/system.js";

/**
 * Single LLM-calling node. This is intentionally minimal — a starting point
 * to prove out the graph → LangGraph Studio → SDK pipeline end-to-end before
 * migrating real ChatKit workflow logic over.
 */
export async function callModel(state: AgentStateType) {
  const model = new ChatOpenAI({
    model: process.env.AGENT_MODEL ?? "gpt-4o-mini",
    temperature: 0.3,
  });

  const response = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    ...state.messages,
  ]);

  return { messages: [response as AIMessage] };
}
