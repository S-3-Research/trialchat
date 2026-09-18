import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { TrialSearchProvider, useTrialSearch } from "@/contexts/TrialSearchContext";
import { TrialSearchChatBridge } from "@/components/assistant-ui/TrialSearchChatBridge";
import { createIdleTrialSearch, fromPersistedTrialSearch, toPersistedTrialSearch, type PersistedTrialSearch } from "@/lib/types/trialSearch";
import { LatestThreadSaveQueue } from "@/lib/latestThreadSaveQueue";

const runtime = vi.hoisted(() => ({
  state: { optional: { threadListItem: { id: "A" } }, thread: { messages: [] as unknown[] } },
  aui: { threadListItem: { updateCustom: vi.fn() } },
  stage: vi.fn(),
}));
vi.mock("@assistant-ui/react", () => ({
  useAuiState: (selector: (s: typeof runtime.state) => unknown) => selector(runtime.state),
  useAui: () => runtime.aui,
}));
vi.mock("@assistant-ui/react-langgraph", () => ({ useLangGraphSetState: () => runtime.stage }));

const settled = (condition: string) => ({
  ...createIdleTrialSearch(),
  status: "success" as const,
  criteria: { conditions: [condition] },
  results: [{ id: condition, title: condition }],
});
const toolResult = (id: string) => ({ parts: [{
  type: "tool-call", toolName: "trial_search", toolCallId: id,
  status: { type: "complete" }, args: { conditions: [id] },
  result: { success: true, trials: [{ id }], total: 1 },
}] });
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
};
let current: ReturnType<typeof useTrialSearch>;
function Capture() { current = useTrialSearch(); return null; }
let root: ReactTestRenderer | undefined;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  runtime.state = { optional: { threadListItem: { id: "A" } }, thread: { messages: [] } };
  vi.clearAllMocks();
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  vi.useRealTimers();
});

describe("thread search isolation", () => {
  it("applies edited criteria and sort in one request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      trials: [{ id: "new-result" }], pagination: { page: 1, pageSize: 10, total: 1 },
    })));
    try {
      await act(async () => { root = create(
        <TrialSearchProvider threadKey="A" initialState={settled("old")}><Capture /></TrialSearchProvider>
      ); });
      await act(async () => { await current.updateTrialSearch({ conditions: ["new"] }, "panel", "distance"); });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
      expect(request).toMatchObject({ criteria: { conditions: ["new"] }, sort: "distance", page: 1 });
      expect(current.search).toMatchObject({ criteria: { conditions: ["new"] }, sort: "distance" });
    } finally { fetchMock.mockRestore(); }
  });

  it("does not replay persisted chat results over later Panel edits on return", async () => {
    runtime.state.thread.messages = [toolResult("old-search")];
    const snapshot = { ...settled("panel-edit"), lastAppliedToolCallId: "old-search" };
    await act(async () => { root = create(
      <TrialSearchProvider threadKey="A" initialState={snapshot}><TrialSearchChatBridge /><Capture /></TrialSearchProvider>
    ); });
    expect(current.search.criteria.conditions).toEqual(["panel-edit"]);
    runtime.state.thread.messages = [toolResult("old-search"), toolResult("new-search")];
    await act(async () => { root!.update(
      <TrialSearchProvider threadKey="A" initialState={snapshot}><TrialSearchChatBridge /><Capture /></TrialSearchProvider>
    ); });
    expect(current.search.criteria.conditions).toEqual(["new-search"]);
    expect(toPersistedTrialSearch(current.search).lastAppliedToolCallId).toBe("new-search");
  });

  it("defers B's result while the Provider still belongs to A, then saves only B", async () => {
    const a = { save: vi.fn<(payload: PersistedTrialSearch) => Promise<void>>().mockResolvedValue(undefined) };
    const b = { save: vi.fn<(payload: PersistedTrialSearch) => Promise<void>>().mockResolvedValue(undefined) };
    const render = (key: string, hydrating: boolean) => (
      <TrialSearchProvider threadKey={key} initialState={settled(key)} persistenceAdapter={key === "A" ? a : b} isHydrating={hydrating}>
        <TrialSearchChatBridge /><Capture />
      </TrialSearchProvider>
    );
    await act(async () => { root = create(render("A", false)); });
    runtime.state.optional.threadListItem.id = "B";
    runtime.state.thread.messages = [toolResult("B-result")];
    await act(async () => { root!.update(render("A", true)); });
    expect(current.search.criteria.conditions).toEqual(["A"]);
    await act(async () => { root!.update(render("B", false)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(a.save).not.toHaveBeenCalled();
    expect(b.save).toHaveBeenCalled();
    expect(b.save.mock.calls[0]?.[0]).toMatchObject({ criteria: { conditions: ["B-result"] } });
  });

  it("accepts a new thread without a sidebar click and never stages A into it", async () => {
    await act(async () => { root = create(
      <TrialSearchProvider threadKey="A" initialState={settled("A")}><TrialSearchChatBridge /><Capture /></TrialSearchProvider>
    ); });
    runtime.stage.mockClear();
    runtime.state.optional.threadListItem.id = "new-thread";
    await act(async () => { root!.update(
      <TrialSearchProvider threadKey="new-thread"><TrialSearchChatBridge /><Capture /></TrialSearchProvider>
    ); });
    expect(current.threadKey).toBe("new-thread");
    expect(current.search.status).toBe("idle");
    expect(runtime.stage).not.toHaveBeenCalled();
  });

  it("keeps the full result list when pinned trials are staged and restored", async () => {
    const search = { ...settled("A"), selectedTrialIds: ["A"], results: [{ id: "A" }, { id: "other" }] };
    await act(async () => { root = create(
      <TrialSearchProvider threadKey="A" initialState={search}><TrialSearchChatBridge /></TrialSearchProvider>
    ); });
    const payload = runtime.stage.mock.lastCall?.[0].activeTrialSearch;
    expect(payload.results).toHaveLength(2);
    expect(payload.selectedTrials).toEqual([{ id: "A" }]);
    expect(fromPersistedTrialSearch(payload).results).toHaveLength(2);
    const before = toPersistedTrialSearch(search);
    await vi.advanceTimersByTimeAsync(1000);
    expect(toPersistedTrialSearch(search)).toEqual(before);
  });

  it("ignores a late Panel response from A after rapid B then C switching", async () => {
    const request = deferred();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      await request.promise;
      return new Response(JSON.stringify({ trials: [{ id: "late-A" }], pagination: { page: 1, pageSize: 10, total: 1 } }));
    });
    const saves = { A: vi.fn(), B: vi.fn(), C: vi.fn() };
    const render = (key: keyof typeof saves) => (
      <TrialSearchProvider threadKey={key} initialState={settled(key)} persistenceAdapter={{ save: async (payload) => { saves[key](payload); } }}>
        <Capture />
      </TrialSearchProvider>
    );
    try {
      await act(async () => { root = create(render("A")); });
      let pending!: Promise<void>;
      await act(async () => { pending = current.startNewTrialSearch({ conditions: ["late-A"] }); });
      await act(async () => { root!.update(render("B")); });
      await act(async () => { root!.update(render("C")); });
      await act(async () => { request.resolve(); await pending; await vi.advanceTimersByTimeAsync(1); });
      expect(current.threadKey).toBe("C");
      expect(current.search.results).toEqual([{ id: "C", title: "C" }]);
      expect(saves.B).not.toHaveBeenCalled();
      expect(saves.C).not.toHaveBeenCalled();
    } finally { fetchMock.mockRestore(); }
  });

  it("saves a reverted selection after an earlier selection is already in flight", async () => {
    const gate = deferred();
    const saved: PersistedTrialSearch[] = [];
    const adapter = { save: async (payload: PersistedTrialSearch) => {
      saved.push(payload);
      if (saved.length === 1) await gate.promise;
    } };
    await act(async () => { root = create(
      <TrialSearchProvider threadKey="A" initialState={{ ...settled("A"), selectedTrialIds: [] }} persistenceAdapter={adapter}><Capture /></TrialSearchProvider>
    ); });
    await act(async () => { current.toggleTrialSelection("A"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    await act(async () => { current.toggleTrialSelection("A"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    await act(async () => { gate.resolve(); });
    expect(saved.map((s) => s.selectedTrialIds)).toEqual([["A"], []]);
  });
});

describe("per-thread save ordering", () => {
  it("deduplicates an identical in-flight snapshot", async () => {
    const queue = new LatestThreadSaveQueue();
    const gate = deferred();
    const save = vi.fn(() => gate.promise);
    const first = queue.enqueue("A", "same", save);
    const duplicate = queue.enqueue("A", "same", save);
    expect(duplicate).toBe(first);
    gate.resolve();
    expect(await first).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.hasPending("A")).toBe(false);
  });

  it("reports permanent failures and allows a subsequent save", async () => {
    const queue = new LatestThreadSaveQueue();
    await expect(queue.enqueue("A", "failed", async () => { throw new Error("500"); })).rejects.toThrow("500");
    expect(queue.hasPending("A")).toBe(false);
    expect(await queue.enqueue("A", "next", async () => {})).toBe(true);
  });

  it("serializes A while allowing B to save independently; drops superseded snapshots", async () => {
    const queue = new LatestThreadSaveQueue();
    const gate = deferred();
    const calls: string[] = [];
    const first = queue.enqueue("A", "1", async () => { calls.push("A1"); await gate.promise; });
    const second = queue.enqueue("A", "2", async () => { calls.push("A2"); });
    const latest = queue.enqueue("A", "3", async () => { calls.push("A3"); });
    await queue.enqueue("B", "1", async () => { calls.push("B1"); });
    expect(calls).toEqual(["A1", "B1"]);
    gate.resolve();
    expect(await latest).toBe(true);
    expect(await first).toBe(false);
    expect(await second).toBe(false);
    expect(calls).toEqual(["A1", "B1", "A3"]);
  });

  it("never retries an old 409 snapshot after a newer edit has arrived", async () => {
    const backoff = deferred();
    const queue = new LatestThreadSaveQueue(() => backoff.promise);
    const oldSave = vi.fn(async () => { throw new Error("409 Thread is busy"); });
    const first = queue.enqueue("A", "old", oldSave);
    await Promise.resolve();
    const newSave = vi.fn(async () => {});
    const latest = queue.enqueue("A", "new", newSave);
    backoff.resolve();
    expect(await latest).toBe(true);
    expect(await first).toBe(false);
    expect(oldSave).toHaveBeenCalledTimes(1);
    expect(newSave).toHaveBeenCalledTimes(1);
  });
});
