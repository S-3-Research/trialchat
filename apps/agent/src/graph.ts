import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./state.js";
import { callModel } from "./nodes/callModel.js";

/**
 * Minimal single-node graph: user message in -> model response out.
 *
 * This is the seam where nodes/tools/checkpointing get added as ChatKit
 * workflow logic is migrated over from apps/web. Exported as `graph` to
 * match the entry declared in langgraph.json.
 */
const workflow = new StateGraph(AgentState)
  .addNode("callModel", callModel)
  .addEdge(START, "callModel")
  .addEdge("callModel", END);

export const graph = workflow.compile();
