import { createClassifierNode } from "../factories/create-classifier-node.js";
import { intentionConfig } from "../configs/intention.config.js";

import { isFrozenScope } from "../lib/trial-scope.js";
import type { AgentStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const classify = createClassifierNode(intentionConfig);
export async function intentionNode(state: AgentStateType, config: LangGraphRunnableConfig) {
  // Scoped chats always use the specialist with a restricted per-run tool set.
  if (isFrozenScope(state.contextScope)) return { intent: "trial_matching" as const };
  return classify(state, config);
}
