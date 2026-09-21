import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScopedThread } from "@/lib/createScopedThread";
const api = vi.hoisted(() => ({ create: vi.fn(), updateState: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/agentClient", () => ({ AGENT_ASSISTANT_ID: "agent", createAgentClient: () => ({ threads: api }) }));
vi.mock("@/lib/guestId", () => ({ getOrCreateGuestUserId: () => "visitor" }));
beforeEach(() => { vi.resetAllMocks(); api.updateState.mockResolvedValue({}); api.delete.mockResolvedValue({}); });
describe("bookmark-derived normal threads", () => {
  it("creates a fresh thread and saves the snapshot before returning the navigation ID", async () => {
    api.create.mockResolvedValueOnce({ thread_id: "one" }).mockResolvedValueOnce({ thread_id: "two" });
    const ids = ["A", "B"];
    const first = createScopedThread("bookmark_full_snapshot", ids, "Discuss trials");
    ids.push("C");
    expect(await first).toBe("one");
    expect(await createScopedThread("bookmark_picked_snapshot", ["B"], "Ask about B")).toBe("two");
    expect(api.create.mock.calls[0][0].graphId).toBe("agent");
    expect(api.create.mock.calls[0][0].metadata).toMatchObject({ userId: "visitor", title: "Discuss trials" });
    expect(api.updateState.mock.calls[0]).toEqual(["one", { values: { contextScope: expect.objectContaining({ type: "bookmark_full_snapshot", trialIds: ["A", "B"] }) } }]);
    expect(api.updateState.mock.calls[1][1].values.contextScope).toMatchObject({ type: "bookmark_picked_snapshot", trialIds: ["B"] });
    expect(api.updateState.mock.calls.every(([, payload]) => !("messages" in payload.values))).toBe(true);
  });
  it("does not navigate when scope persistence fails, and cleans up the empty thread", async () => {
    api.create.mockResolvedValue({ thread_id: "failed" });
    api.updateState.mockRejectedValue(new Error("Offline"));
    await expect(createScopedThread("bookmark_picked_snapshot", ["A"], "Ask about A")).rejects.toThrow("Offline");
    expect(api.delete).toHaveBeenCalledWith("failed");
  });
  it("does not create empty conversations", async () => {
    await expect(createScopedThread("bookmark_picked_snapshot", [], "Empty")).rejects.toThrow();
    expect(api.create).not.toHaveBeenCalled();
  });
});
