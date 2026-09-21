import { describe, expect, it, vi, afterEach } from "vitest";
import { addTrialBookmark, readBookmarks, removeTrialBookmark, createTrialScope, toTrialSnapshot } from "@/lib/bookmarks";

function storage(): Storage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, key: (i) => [...data.keys()][i] ?? null, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); }, clear: () => data.clear() };
}
afterEach(() => vi.restoreAllMocks());
describe("global bookmarks and independent snapshots", () => {
  it("isolates visitors, is idempotent and persists a captured trial snapshot", () => {
    const store = storage();
    addTrialBookmark(store, "user-a", "NCT00000001", { id: "NCT00000001", title: "Trial A" }, { sourceThreadId: "thread-a" });
    addTrialBookmark(store, "user-a", "NCT00000001", { id: "NCT00000001", title: "Different title" }, { sourceThreadId: "thread-b" });
    addTrialBookmark(store, "user-b", "NCT00000001");
    expect(readBookmarks(store, "user-a")).toHaveLength(1);
    expect(readBookmarks(store, "user-a")[0]).toMatchObject({ sourceThreadId: "thread-a", trialId: "NCT00000001", trial: { title: "Trial A" } });
    expect(Object.keys(readBookmarks(store, "user-a")[0])).toEqual(["id", "userId", "trialId", "createdAt", "trial", "sourceThreadId"]);
    expect(readBookmarks(store, "user-b")[0].trial).toBeUndefined();
    removeTrialBookmark(store, "user-a", "NCT00000001");
    removeTrialBookmark(store, "user-a", "NCT00000001");
    expect(readBookmarks(store, "user-a")).toEqual([]);
    expect(readBookmarks(store, "user-b")).toHaveLength(1);
  });
  it("freezes each thread's membership and trial data across later bookmark changes", () => {
    const store = storage();
    for (const id of ["A", "B", "C"]) addTrialBookmark(store, "user", id, { id, title: `Title ${id}` });
    const original = readBookmarks(store, "user");
    const first = createTrialScope("bookmark_full_snapshot", original.map((b) => b.trialId), original.map((b) => b.trial!));
    removeTrialBookmark(store, "user", "B");
    addTrialBookmark(store, "user", "D", { id: "D", title: "Title D" });
    const second = createTrialScope("bookmark_full_snapshot", readBookmarks(store, "user").map((b) => b.trialId), readBookmarks(store, "user").map((b) => b.trial!));
    expect([...first.trialIds].sort()).toEqual(["A", "B", "C"]);
    expect(first.trials.map((t) => t.title).sort()).toEqual(["Title A", "Title B", "Title C"]);
    expect([...second.trialIds].sort()).toEqual(["A", "C", "D"]);
  });
  it("supports selected and single trials, drops trials outside the given IDs, and rejects empty scope", () => {
    expect(createTrialScope("bookmark_picked_snapshot", ["A", "C", "A"]).trialIds).toEqual(["A", "C"]);
    expect(createTrialScope("bookmark_picked_snapshot", ["A"]).trialIds).toEqual(["A"]);
    expect(createTrialScope("bookmark_picked_snapshot", ["A"], [{ id: "A", title: "A" }, { id: "B", title: "B" }]).trials).toEqual([{ id: "A", title: "A" }]);
    expect(() => createTrialScope("bookmark_full_snapshot", [])).toThrow();
  });
  it("trims a live search-result trial down to the snapshot shape", () => {
    expect(toTrialSnapshot({ id: "A", title: "A", recruitment_status: "recruiting", reports: [{ result: true, filter_type: "age", result_text: "ok" }], rank: 1 })).toEqual({ id: "A", title: "A", recruitment_status: "recruiting", summary: undefined, eligibility_summary: undefined, conditions: undefined, phases: undefined, locations: undefined, min_age: undefined, max_age: undefined, links: undefined });
    expect(toTrialSnapshot({})).toBeUndefined();
  });
});

