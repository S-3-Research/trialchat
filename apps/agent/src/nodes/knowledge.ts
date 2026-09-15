import { createAgentNode } from "../factories/create-agent-node.js";
import { knowledgeConfig } from "../configs/knowledge.config.js";

export const knowledgeAgent = createAgentNode(knowledgeConfig);
