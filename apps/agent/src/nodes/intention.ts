import { createClassifierNode } from "../factories/create-classifier-node.js";
import { intentionConfig } from "../configs/intention.config.js";

export const intentionNode = createClassifierNode(intentionConfig);
