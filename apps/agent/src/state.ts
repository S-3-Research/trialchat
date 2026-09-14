import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

/**
 * Shared graph state for the Trial Chat agent.
 *
 * `messages` follows the standard LangGraph "messages" convention so the
 * graph is compatible with LangGraph Studio, the LangGraph SDK, and
 * standard chat-style clients out of the box.
 */
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  // Free-form context passed in from the web app at session start
  // (e.g. intake answers: role, response_style, intent).
  userContext: Annotation<Record<string, unknown>>({
    reducer: (_left, right) => right,
    default: () => ({}),
  }),
});

export type AgentStateType = typeof AgentState.State;
