import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { BookmarkSnapshotPanel, type TrialSnapshot } from "@/components/bookmarks/BookmarkSnapshotPanel";
import { ThreadScopeHeader } from "@/components/bookmarks/ThreadScope";

const live = vi.hoisted(() => ({ bookmarks: [{ trialId: "NCT00000001", trial: { id: "NCT00000001", title: "Trial title", eligibility_summary: "Eligibility details" } }], ready: true }));
const createThread = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useBookmarks", () => ({ useBookmarks: () => live }));
vi.mock("@/lib/createScopedThread", () => ({ createScopedThread: createThread }));
vi.mock("next/link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
vi.mock("@assistant-ui/react", () => ({ useAui: () => ({}) }));
const scope: TrialSnapshot = { type: "bookmark_full_snapshot", trialIds: ["NCT00000001", "NCT00000002"], capturedAt: "2026-09-21T00:00:00Z", trials: [{ id: "NCT00000001", title: "Trial title", eligibility_summary: "Eligibility details" }] };
let root: ReactTestRenderer;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const text = () => JSON.stringify(root.toJSON());
describe("snapshot panel", () => {
  it("retains all members and permits details/focus without mutation controls, never fetching live", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const original = JSON.stringify(scope);
    await act(async () => { root = create(<BookmarkSnapshotPanel scope={scope} onClose={() => undefined} />); });
    expect(text()).toContain("Bookmarked Trials");
    expect(text()).toContain("These are the trials included when this conversation started.");
    const buttons = root.root.findAllByType("button");
    expect(buttons).toHaveLength(3); // collapse + details for each trial
    expect(text()).not.toMatch(/Ask TrialChat|Remove bookmark|Edit filters|Load more|Add new bookmarks/);
    await act(async () => { buttons[1].props.onClick({ stopPropagation() {} }); });
    expect(text()).toContain("Eligibility details");
    const cards = root.root.findAll((node) => node.type === "div" && node.props.tabIndex === 0);
    await act(async () => { cards[0].props.onClick(); });
    expect(cards).toHaveLength(2);
    expect(JSON.stringify(scope)).toBe(original);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps unavailable trials in the fixed collection when no snapshot was saved for them", async () => {
    await act(async () => { root = create(<BookmarkSnapshotPanel scope={scope} onClose={() => undefined} />); });
    expect(text()).toContain("Trial title");
    expect(text()).toContain("NCT00000002");
    expect(text()).toContain("No saved details for this trial.");
  });
});
describe("collection change notice", () => {
  it("creates a different conversation carrying the current snapshots, never changes the current snapshot", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    createThread.mockResolvedValue("new-thread");
    await act(async () => { root = create(<ThreadScopeHeader scope={scope} onViewTrials={() => undefined} />); });
    expect(text()).toContain("Your bookmarks have changed");
    const start = root.root.findAllByType("button").find((b) => b.children.join("").includes("Start a new chat"))!;
    await act(async () => { await start.props.onClick(); });
    expect(createThread).toHaveBeenCalledWith("bookmark_full_snapshot", ["NCT00000001"], "Discuss 1 bookmarked trial", [live.bookmarks[0].trial]);
    expect(assign).toHaveBeenCalledWith("/trial-chat/chat-v2?thread=new-thread");
    expect(scope.trialIds).toHaveLength(2);
  });
  it("does not mislabel a deliberate selection as a changed collection", async () => {
    await act(async () => { root = create(<ThreadScopeHeader scope={{ ...scope, type: "bookmark_picked_snapshot" }} onViewTrials={() => undefined} />); });
    expect(text()).not.toContain("Your bookmarks have changed");
    expect(text()).toContain("Search for more trials");
  });
});

