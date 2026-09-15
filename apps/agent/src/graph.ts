import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { AgentState } from "./state.js";
import { callModel } from "./nodes/callModel.js";
import { tools } from "./tools/index.js";
import { getCheckpointer } from "./checkpointer.js";

/**
 * Agent loop: user message in -> model (may call tools) -> tools (if any) ->
 * back to model -> ... -> final response out.
 *
 * `toolsCondition` routes to `tools` whenever the model's last message
 * contains tool calls, and to END otherwise. This is the seam where
 * ChatKit workflow logic (clinical trial search, etc.) gets migrated over.
 *
 * Exported as `graph` to match the entry declared in langgraph.json. It's an
 * async factory (rather than a pre-compiled graph) because the checkpointer
 * needs to asynchronously connect to / migrate Postgres before the graph can
 * be compiled with it — the LangGraph CLI supports graph entries that
 * resolve to a `CompiledGraph` via a Promise.
 */
const workflow = new StateGraph(AgentState)
  .addNode("callModel", callModel)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "callModel")
  .addConditionalEdges("callModel", toolsCondition, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "callModel");

export async function graph() {
  const checkpointer = await getCheckpointer();
  return workflow.compile({ checkpointer });
}
