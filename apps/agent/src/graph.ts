import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState, type AgentStateType } from "./state.js";
import { intentionNode } from "./nodes/intention.js";
import { knowledgeAgent } from "./nodes/knowledge.js";
import { apiAgent } from "./nodes/api-agent.js";
import { otherQuestionsAgent } from "./nodes/other-questions.js";
import { suggestionsAgent } from "./nodes/suggestions.js";
import { getCheckpointer } from "./checkpointer.js";

/**
 * Intent-routed agent loop:
 *
 *   START -> intention -+-> knowledge -------> suggestions_agent -> END
 *                        +-> api_agent -------> suggestions_agent -> END
 *                        +-> other_questions -> suggestions_agent -> END
 *
 * The three answer-facing branches run on a reasoning-capable model
 * (gpt-5-mini) via OpenAI's Responses API with `reasoning.summary`
 * enabled (see `factories/create-agent-node.ts`), so their AIMessage
 * carries a real `additional_kwargs.reasoning` — surfaced on the frontend
 * via assistant-ui's `MessagePrimitive.GroupedParts`, not a custom
 * widget/state channel.
 *
 * `intention` classifies the user's latest message ("knowledge" |
 * "trial_matching" | "other") and writes it to `state.intent`; the
 * conditional edge below routes to the matching specialist node. Each
 * specialist is a `model + prompt + tools[]` node built by
 * `createAgentNode` (see `factories/create-agent-node.ts`) — tool-calling
 * (including any local "function" tool execute/respond loop) happens
 * *inside* that node, so there's no separate `tools` node here; which
 * tools a node has access to is entirely a `configs/*.config.ts` concern.
 * All three paths converge on `suggestions_agent`, which reads the full
 * conversation and pushes follow-up prompts to the UI as an explicit
 * Generative UI message (via `typedUi(config).push(...)`, see
 * `nodes/suggestions.ts`) bound to the preceding branch's assistant
 * message id, rather than writing to a plain state field.
 *
 * Adding or tweaking a branch should only require touching this file plus
 * one node/config pair; adding a new *capability* (knowledge base, web
 * search, trial search, or anything later — MCP, calculator, etc.) is a
 * `tools/*.tool.ts` addition, not a graph or node change.
 *
 * Exported as `graph` to match the entry declared in langgraph.json. It's an
 * async factory (rather than a pre-compiled graph) because the checkpointer
 * needs to asynchronously connect to / migrate Postgres before the graph can
 * be compiled with it — the LangGraph CLI supports graph entries that
 * resolve to a `CompiledGraph` via a Promise.
 */
const workflow = new StateGraph(AgentState)
  .addNode("intention", intentionNode)
  .addNode("knowledge", knowledgeAgent)
  .addNode("api_agent", apiAgent)
  .addNode("other_questions", otherQuestionsAgent)
  // Named "suggestions_agent" (not "suggestions") because LangGraph forbids
  // a node name colliding with a state channel name — `state.ui` is the
  // Generative UI channel this node's `typedUi(config).push(...)` call
  // writes into (see nodes/suggestions.ts).
  .addNode("suggestions_agent", suggestionsAgent)

  .addEdge(START, "intention")
  .addConditionalEdges(
    "intention",
    (state: AgentStateType) => state.intent ?? "other",
    {
      knowledge: "knowledge",
      trial_matching: "api_agent",
      other: "other_questions",
    }
  )

  .addEdge("knowledge", "suggestions_agent")
  .addEdge("api_agent", "suggestions_agent")
  .addEdge("other_questions", "suggestions_agent")
  .addEdge("suggestions_agent", END);

export async function graph() {
  const checkpointer = await getCheckpointer();
  return workflow.compile({ checkpointer });
}
