/**
 * Mirrors `apps/web/lib/types/trialSearch.ts`'s `TrialSearchState` shape.
 *
 * There's no shared package wiring between apps/web (Next.js) and
 * apps/agent (LangGraph.js server) yet — `packages/shared-types` exists
 * but neither app currently depends on it, and `trial-search.tool.ts`
 * already duplicates the web app's `flattenTrial`/criteria shape
 * independently rather than importing across the app boundary. This type
 * follows that same established pattern: kept in sync by hand with
 * trialSearch.ts, not by a build-time shared import.
 *
 * Deliberately NOT summarized/truncated — every field the Trial Panel
 * shows (full criteria, full pagination, the full selected trial, and the
 * full current result page) is passed through as-is, so the agent never
 * has less information than what the user is currently looking at.
 */

export type ActiveTrialSearchLocation = {
  city?: string;
  state?: string;
  country?: string;
};

export type ActiveTrialSearchMatchReport = {
  result: boolean;
  filter_type: string;
  result_text: string;
};

export type ActiveTrialSearchTrial = {
  id?: string;
  title?: string;
  recruitment_status?: string;
  summary?: string;
  locations?: ActiveTrialSearchLocation[];
  phases?: string[];
  conditions?: string[];
  intervention_types?: string[];
  rank?: number;
  reports?: ActiveTrialSearchMatchReport[];
  eligibility_summary?: string;
  min_age?: number;
  max_age?: number;
  links?: string[];
};

export type ActiveTrialSearchCriteria = {
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
  otherFilters?: Record<string, unknown>;
};

export type ActiveTrialSearchPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
  hasNextPage: boolean;
};

/**
 * What the web app pushes into `AgentState.activeTrialSearch` (via
 * `useLangGraphSetState`, see TrialSearchChatBridge.tsx) whenever the
 * shared `activeTrialSearch` React state changes. Read by
 * `createAgentNode` (when `config.includeActiveTrialSearchContext` is
 * set — currently only `api-agent.config.ts`) and spliced into the model
 * input as a system-role context message, never persisted into
 * `state.messages` (see create-agent-node.ts for why that avoids
 * unbounded growth across turns).
 */
export type ActiveTrialSearchContext = {
  lastAppliedToolCallId?: string;
  selectedTrialIds?: string[];
  updatedAt?: string;
  criteria: ActiveTrialSearchCriteria;
  sort?: "relevance" | "distance";
  pagination: ActiveTrialSearchPagination;
  /** The current page of results as shown in the Trial Panel right now. */
  results: ActiveTrialSearchTrial[];
  /** Trials the user has explicitly pinned to ask about (multi-select, see selectedTrialIds in the web app). */
  selectedTrials?: ActiveTrialSearchTrial[];
  status: "idle" | "searching" | "loading-more" | "success" | "error";
};
