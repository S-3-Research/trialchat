/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Synced from packages/shared-types/src/index.ts via
 * `npm run sync-shared-types --workspace=apps/agent`.
 *
 * The agent app is built as a standalone LangGraph deployment (its
 * langgraph.json packages only this directory for builds/deploys), with
 * no access to the monorepo root or lockfile at build time. So it can't
 * depend on the @acadia/shared-types workspace package directly; this
 * generated copy is what the agent actually imports at runtime.
 *
 * If you change ThreadContextScope or TrialSnapshot in
 * packages/shared-types/src/index.ts, re-run the sync script and commit
 * the result. CI (`npm run check-shared-types`) fails the build if this
 * file drifts out of sync with the source.
 */

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

export type ThreadContextScope =
  | { type: "trial_search"; searchId: string }
  | {
      type: "bookmark_picked_snapshot" | "bookmark_full_snapshot";
      readonly trialIds: readonly string[];
      readonly capturedAt: string;
      /** Inline trial data captured at scope-creation time — the agent and UI read this directly, never a live registry call. */
      readonly trials: readonly TrialSnapshot[];
    };
