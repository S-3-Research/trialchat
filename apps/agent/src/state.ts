import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * Shared graph state for the Trial Chat agent.
 *
 * Spreads the prebuilt `MessagesAnnotation` for the `messages` key so the
 * generated JSON schema properly reflects the full Human/AI/System/Tool
 * message union — required for LangGraph Studio's chat view to recognize
 * this as a standard chat-compatible graph (a hand-rolled
 * `Annotation<BaseMessage[]>` loses that union in the generated schema).
 */
export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  // Free-form context passed in from the web app at session start
  // (e.g. intake answers: role, response_style, intent).
  userContext: Annotation<Record<string, unknown>>({
    reducer: (_left, right) => right,
    default: () => ({}),
  }),
});

export type AgentStateType = typeof AgentState.State;
