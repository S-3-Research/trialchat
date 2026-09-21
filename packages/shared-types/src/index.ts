/**
 * Trial detail fields captured at bookmark time and carried verbatim into
 * any frozen conversation scope built from bookmarks — the sole source of
 * truth for "what this trial looked like" in those conversations. Never
 * refreshed live; see ThreadContextScope's frozen variant below.
 */
export type TrialSnapshot = {
  id: string;
  title?: string;
  recruitment_status?: string;
  summary?: string;
  eligibility_summary?: string;
  conditions?: string[];
  phases?: string[];
  locations?: { city?: string; state?: string; country?: string }[];
  min_age?: number;
  max_age?: number;
  links?: string[];
};

/** Bookmarks are reference records that also carry the trial data captured when saved. */
export type TrialBookmark = {
  id: string;
  userId: string;
  trialId: string;
  createdAt: string;
  sourceThreadId?: string;
  sourceSearchId?: string;
  note?: string;
  tags?: string[];
  /** Trial data as it looked at bookmark time; absent for legacy bookmarks saved before this field existed. */
  trial?: TrialSnapshot;
};

export type ThreadContextScope =
  | { type: "trial_search"; searchId: string }
  | {
      type: "bookmark_picked_snapshot" | "bookmark_full_snapshot";
      readonly trialIds: readonly string[];
      readonly capturedAt: string;
      /** Inline trial data captured at scope-creation time — the agent and UI read this directly, never a live registry call. */
      readonly trials: readonly TrialSnapshot[];
    };
