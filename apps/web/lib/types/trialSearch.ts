/**
 * Canonical shared trial-search state.
 *
 * This is the single source of truth for "what trial search is currently
 * active" — both the Chat agent (via the `trial_search` tool) and the
 * Trial Panel (via direct structured filter controls) read and write this
 * same state through the Search Controller (see
 * contexts/TrialSearchContext.tsx). Neither Chat nor the Trial Panel owns
 * its own parallel copy.
 */

export type TrialLocation = {
  city?: string;
  state?: string;
  country?: string;
};

export type TrialMatchReport = {
  result: boolean;
  filter_type: string;
  result_text: string;
};

export type Trial = {
  id?: string;
  title?: string;
  recruitment_status?: string;
  summary?: string;
  locations?: TrialLocation[];
  phases?: string[];
  conditions?: string[];
  intervention_types?: string[];
  rank?: number;
  /** Per-criteria match diagnostics from the external API's `reports[]`. */
  reports?: TrialMatchReport[];
  eligibility_summary?: string;
  min_age?: number;
  max_age?: number;
  links?: string[];
};

/** Structured criteria for a trial search — mirrors the external trials API. */
export type TrialSearchCriteria = {
  conditions?: string[];
  age?: number;
  min_age?: number;
  max_age?: number;
  sex?: "male" | "female" | "all";
  city?: string;
  state?: string;
  county?: string;
  country?: string;
  zipcode?: string;
  street?: string;
  lat?: number;
  lon?: number;
  pref_distance?: number;
  drive_duration?: number;
  intervention_types?: string[];
  phases?: string[];
  recruitingStatus?: "recruiting" | "all";
  /** Escape hatch for less-common filters without widening this type. */
  otherFilters?: Record<string, unknown>;
};

export type TrialSearchSort = "relevance" | "distance";

export type TrialSearchStatus =
  | "idle"
  | "searching"
  | "loading-more"
  | "success"
  | "error";

export type TrialSearchPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
  hasNextPage: boolean;
};

export type TrialSearchState = {
  id: string;
  query?: string;
  criteria: TrialSearchCriteria;
  sort?: TrialSearchSort;
  results: Trial[];
  pagination: TrialSearchPagination;
  /**
   * Trials the user has actively "pinned" to ask about — drives both the
   * card's persistent blue highlight AND the composer's "Re: <trial>"
   * pills (one per id). Multi-select, capped at MAX_SELECTED_TRIALS so the
   * pill row stays usable; toggled on/off by clicking a card. Comparison
   * questions across multiple selected trials are a future step — for now
   * this just keeps every selected trial visibly scoped in the composer.
   */
  selectedTrialIds?: string[];
  /**
   * Trials currently being asked about — scoped to the *current chat run*
   * (set when a preset "Ask TrialChat" question is sent, cleared by
   * TrialPanel.tsx ~1.5s after `thread.isRunning` flips back to false).
   * Purely cosmetic: drives a distinct pulse highlight on the card and,
   * while set, dims/locks every other (non-selected) card in the panel so
   * the user can see at a glance which trial the in-flight answer is
   * about. Independent from `selectedTrialIds` — being asked about does
   * not add/remove a trial from the persistent multi-select or its
   * composer pill.
   */
  askedTrialIds?: string[];
  status: TrialSearchStatus;
  error?: string;
  updatedAt?: string;
};

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_SELECTED_TRIALS = 5;

export function createIdleTrialSearch(): TrialSearchState {
  return {
    id: "idle",
    criteria: {},
    results: [],
    pagination: {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      total: 0,
      hasNextPage: false,
    },
    status: "idle",
  };
}

export function createSearchId(): string {
  return `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
