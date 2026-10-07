import { describe, it, expect, vi } from "vitest";
import { MemorySaver, StateGraph, START, END } from "@langchain/langgraph";
import { z } from "zod";
import { AgentState } from "../src/state.js";
import { preserveTrialScope, toolsForTrialScope } from "../src/lib/trial-scope.js";
import type { ThreadContextScope } from "../src/types/thread-context-scope.js";

const scope: ThreadContextScope = { type: "bookmark_full_snapshot", trialIds: ["NCT00000001", "NCT00000002"], capturedAt: "2026-09-21T00:00:00Z", trials: [{ id: "NCT00000001", title: "Trial One" }, { id: "NCT00000002", title: "Trial Two" }] };
describe("fixed conversation scope", () => {
  it("rejects additions, removals, replacement, clearing and type changes", () => {
    expect(preserveTrialScope(undefined, scope)).toEqual(scope);
    expect(preserveTrialScope(scope, { ...scope })).toBe(scope);
    for (const replacement of [undefined, { ...scope, trialIds: ["NCT00000001"] }, { ...scope, trialIds: [...scope.trialIds, "NCT00000003"] }, { ...scope, capturedAt: "2026-09-22T00:00:00Z" }, { type: "trial_search" as const, searchId: "new" }]) {
      expect(preserveTrialScope(scope, replacement)).toBe(scope);
    }
  });
  it("keeps a legacy expanded checkpoint fixed at its current membership", () => {
    const legacy = { ...scope, version: 3, updatedAt: "2026-09-21T01:00:00Z" };
    expect(preserveTrialScope(legacy, scope)).toBe(legacy);
    expect(preserveTrialScope(legacy, { ...scope, trialIds: ["different"] })).toBe(legacy);
  });
  it("enforces immutability during real checkpoint writes and runs", async () => {
    const graph = new StateGraph(AgentState).addNode("reply", () => ({})).addEdge(START, "reply").addEdge("reply", END).compile({ checkpointer: new MemorySaver() });
    const config = { configurable: { thread_id: "frozen" } };
    await graph.updateState(config, { contextScope: scope });
    await graph.invoke({ messages: [] }, config);
    await graph.updateState(config, { contextScope: { ...scope, trialIds: ["NCT00000003"] } });
    await graph.invoke({ contextScope: { ...scope, trialIds: [] } }, config);
    expect((await graph.getState(config)).values.contextScope).toEqual(scope);
  });
  it("never binds discovery tools, reads only the inline snapshot, and rejects out-of-scope IDs before I/O", async () => {
    const fetchDetails = vi.fn().mockResolvedValue({ success: true });
    const search = vi.fn();
    const definitions = [
      { name: "trial_details", description: "details", schema: z.object({ trialIds: z.array(z.string()) }), execute: fetchDetails },
      { name: "trial_search", description: "search", schema: z.object({}), execute: search },
      { name: "web_search", description: "web", schema: z.object({}), execute: search },
    ];
    const restricted = toolsForTrialScope(definitions, scope);
    expect(restricted.map((t) => t.name)).toEqual(["trial_details"]);
    expect(await restricted[0].execute({ trialIds: ["NCT00000001", "NCT00000003"] })).toHaveProperty("error");
    expect(fetchDetails).not.toHaveBeenCalled();
    expect(await restricted[0].execute({ trialIds: ["NCT00000002"] })).toEqual([{ id: "NCT00000002", title: "Trial Two" }]);
    // Never calls the live tool implementation — reads straight from the snapshot.
    expect(fetchDetails).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(toolsForTrialScope(definitions, undefined)).toBe(definitions);
  });
});
