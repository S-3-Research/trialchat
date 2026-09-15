import { createAgentNode } from "../factories/create-agent-node.js";
import { otherQuestionsConfig } from "../configs/other-questions.config.js";

export const otherQuestionsAgent = createAgentNode(otherQuestionsConfig);
