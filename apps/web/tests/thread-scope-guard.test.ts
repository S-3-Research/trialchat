import { describe, expect, it } from "vitest";
import { requestedScopes, overwritesFrozenScope } from "@/lib/threadScopeGuard";
import type { ThreadContextScope } from "@acadia/shared-types";
const saved: ThreadContextScope = { type: "bookmark_picked_snapshot", trialIds: ["A", "B"], capturedAt: "2026-09-21T00:00:00Z", trials: [] };
describe("scope write barrier", () => {
  it("detects edits through checkpoints, run inputs, and bulk updates", () => {
    for (const payload of [{ values: { contextScope: null } }, { input: { contextScope: { ...saved, trialIds: ["A"] } } }, { supersteps: [{ updates: [{ values: { contextScope: { ...saved, trialIds: ["A", "B", "C"] } } }] }] }]) {
      expect(overwritesFrozenScope(saved, requestedScopes(payload))).toBe(true);
    }
  });
  it("allows initialization, identical scope and unrelated message/search updates", () => {
    expect(overwritesFrozenScope(undefined, requestedScopes({ values: { contextScope: saved } }))).toBe(false);
    expect(overwritesFrozenScope(saved, requestedScopes({ input: { contextScope: saved } }))).toBe(false);
    expect(overwritesFrozenScope(saved, requestedScopes({ input: { messages: [] } }))).toBe(false);
  });
});

import { afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/agent/[...path]/route";
afterEach(() => vi.restoreAllMocks());
it("returns 409 before forwarding a scope mutation to the agent", async () => {
  const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ values: { contextScope: saved } }));
  const response = await POST(new NextRequest("http://localhost/api/agent/threads/thread-a/state", { method: "POST", body: JSON.stringify({ values: { contextScope: null } }) }), { params: Promise.resolve({ path: ["threads", "thread-a", "state"] }) });
  expect(response.status).toBe(409);
  expect(upstream).toHaveBeenCalledOnce();
  expect(upstream.mock.calls[0][0]).toContain("/threads/thread-a/state");
  expect(upstream.mock.calls[0][1]).toEqual({ cache: "no-store" });
});
