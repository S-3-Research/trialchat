import type { TrialBookmark, ThreadContextScope, TrialSnapshot } from "@acadia/shared-types";
import type { Trial } from "@/lib/types/trialSearch";
export type { TrialBookmark, ThreadContextScope, TrialSnapshot } from "@acadia/shared-types";

/** Trims a live search-result `Trial` down to the fields captured in a bookmark/scope snapshot. */
export function toTrialSnapshot(trial: Trial): TrialSnapshot | undefined {
  if (!trial.id) return undefined;
  const { id, title, recruitment_status, summary, eligibility_summary, conditions, phases, locations, min_age, max_age, links } = trial;
  return { id, title, recruitment_status, summary, eligibility_summary, conditions, phases, locations, min_age, max_age, links };
}

// One key per membership prevents unrelated cross-tab additions from overwriting
// each other. The guest identity is shared with normal conversation ownership.
const PREFIX = "trialchat:bookmark:";
export const BOOKMARK_EVENT = "trialchat:bookmarks-changed";
const keyFor = (userId: string, trialId: string) => `${PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(trialId)}`;
export function readBookmarks(storage: Storage, userId: string): TrialBookmark[] {
  const prefix = `${PREFIX}${encodeURIComponent(userId)}:`;
  const result: TrialBookmark[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const raw = storage.getItem(key);
    if (!raw) continue;
    const bookmark = JSON.parse(raw) as TrialBookmark;
    if (bookmark.userId === userId && typeof bookmark.trialId === "string") result.push(bookmark);
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
/** `trial` captures the trial's data as it looked at bookmark time — the only copy any frozen conversation built from this bookmark will ever see. */
export function addTrialBookmark(storage: Storage, userId: string, trialId: string, trial?: TrialSnapshot, provenance: Pick<TrialBookmark, "sourceThreadId" | "sourceSearchId"> = {}) {
  const key = keyFor(userId, trialId);
  if (storage.getItem(key)) return;
  const bookmark: TrialBookmark = { id: crypto.randomUUID(), userId, trialId, createdAt: new Date().toISOString(), ...(trial ? { trial } : {}), ...provenance };
  storage.setItem(key, JSON.stringify(bookmark));
}
export function removeTrialBookmark(storage: Storage, userId: string, trialId: string) {
  storage.removeItem(keyFor(userId, trialId));
}
/** `trials` should be the snapshot data (e.g. from the source `TrialBookmark`s) for each ID; entries missing a snapshot are simply omitted, not fetched. */
export function createTrialScope(type: "bookmark_full_snapshot" | "bookmark_picked_snapshot", trialIds: string[], trials: TrialSnapshot[] = []): Exclude<ThreadContextScope, { type: "trial_search" }> {
  const ids = [...new Set(trialIds)];
  if (!ids.length) throw new Error("Select at least one trial.");
  const idSet = new Set(ids);
  return { type, trialIds: ids, capturedAt: new Date().toISOString(), trials: trials.filter((t) => idSet.has(t.id)) };
}
