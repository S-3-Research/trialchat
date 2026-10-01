import type { ThreadContextScope } from "@acadia/shared-types";
import type { AgentTool } from "../tools/registry.js";

export function isFrozenScope(scope?: ThreadContextScope): scope is Exclude<ThreadContextScope, { type: "trial_search" }> {
  return scope?.type === "bookmark_full_snapshot" || scope?.type === "bookmark_picked_snapshot";
}

/** Enforced by the checkpoint reducer, including direct state writes/run input. */
export function preserveTrialScope(left: ThreadContextScope | undefined, right: ThreadContextScope | undefined): ThreadContextScope | undefined {
  if (isFrozenScope(left)) {
    // Never throw for an overwrite: LangGraph can retain rejected run writes
    // as pending writes and replay them on getState, making history unreadable.
    // The web API rejects explicit edits; this reducer is the final write barrier.
    return left;
  }
  if (isFrozenScope(right)) {
    if (!Array.isArray(right.trialIds) || !right.trialIds.length || right.trialIds.some((id) => typeof id !== "string" || !id.trim()) || !Number.isFinite(Date.parse(right.capturedAt))) throw new Error("Invalid trial scope");
    return { type: right.type, trialIds: [...new Set(right.trialIds)], capturedAt: right.capturedAt, trials: right.trials ?? [] };
  }
  return right;
}

/**
 * The per-invocation tool allowlist also blocks crafted/hallucinated tool
 * calls. When frozen, `trial_details` is rebound to read exclusively from
 * the scope's inline `trials` snapshot (captured at bookmark time) — it
 * never calls the live registry, so a discussion of bookmarked trials can
 * never drift from what the user saved, and never depends on the registry
 * being reachable.
 */
export function toolsForTrialScope(tools: AgentTool[], scope?: ThreadContextScope): AgentTool[] {
  if (!isFrozenScope(scope)) return tools;
  const allowed = new Set(scope.trialIds.map((id) => id.toUpperCase()));
  const snapshotById = new Map(scope.trials.map((t) => [t.id.toUpperCase(), t]));
  return tools.filter((tool) => tool.name === "trial_details").map((tool) => ({
    ...tool,
    execute: async (args: { trialIds: string[] }) => {
      if (args.trialIds.some((id) => !allowed.has(id.toUpperCase()))) return { error: "Only trials included when this conversation started may be retrieved. Use Search for more trials to start a separate search." };
      return args.trialIds.map((id) => snapshotById.get(id.toUpperCase()) ?? { id, error: "No saved details for this trial in this conversation's snapshot." });
    },
  }));
}

export const FROZEN_SCOPE_INSTRUCTIONS = `This conversation discusses a fixed set of trials, chosen when it started. The trial IDs below are immutable, even if the user asks to add, remove, replace, or find more trials. You may compare, summarize, explain eligibility, rank, and filter WITHIN this set; a filtered answer never changes membership. Never substitute active search results or live bookmarks. Details for these trials come only from the snapshot captured when this conversation started, via trial_details — do not invent unavailable details, and do not claim to have current/live registry data. If asked to discover additional trials, explain that this requires a separate search and offer [Search for more trials →](/chat?new=1). To discuss a different set, direct the user to [Bookmarks](/bookmarks) to curate it and start a new chat. Never claim to have modified this conversation's trials.`;
