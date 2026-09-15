import { createAgentNode } from "../factories/create-agent-node.js";
import { apiAgentConfig } from "../configs/api-agent.config.js";

export const apiAgent = createAgentNode(apiAgentConfig);
