"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createIdleTrialSearch,
  createSearchId,
  DEFAULT_PAGE_SIZE,
  MAX_SELECTED_TRIALS,
  type Trial,
  type TrialSearchCriteria,
  type TrialSearchSort,
  type TrialSearchState,
} from "@/lib/types/trialSearch";

/**
 * Search Controller (shared state) for the trial-search feature.
 *
 * `activeTrialSearch` is the single source of truth. Both Chat (via
 * `ingestChatToolResult`, called from a bridge component that watches the
 * `trial_search` tool's messages — see
 * components/assistant-ui/TrialSearchChatBridge.tsx) and the Trial Panel
 * (via the structured mutators below) read/write this same state.
 *
 * Structured Panel actions (filters, sort, pagination, select) call the
 * backend directly through this controller and never touch the LLM.
 * Natural-language Chat requests are interpreted by the agent into a
 * structured tool call, whose result is ingested here the same way.
 */

type TrialSearchSource = "chat" | "panel";

type TrialSearchApi = {
  search: TrialSearchState;
  /**
   * Search history (spec section 17) — not yet exposed in any UI, but the
   * state is tracked from day one so a future "Recent searches" panel
   * doesn't require a data-model migration. A true new search snapshots
   * the previous active search into this array before replacing it;
   * refinements never push (they patch the same search in place).
   */
  searchHistory: TrialSearchState[];
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  startNewTrialSearch: (
    criteria: TrialSearchCriteria,
    source?: TrialSearchSource
  ) => Promise<void>;
  updateTrialSearch: (
    patch: Partial<TrialSearchCriteria>,
    source?: TrialSearchSource
  ) => Promise<void>;
  updateTrialSearchSort: (sort: TrialSearchSort) => Promise<void>;
  loadNextTrialSearchPage: () => Promise<void>;
  /** Toggles a trial in/out of the persistent multi-select (cards + composer pills), capped at MAX_SELECTED_TRIALS. */
  toggleTrialSelection: (trialId: string) => void;
  /** Marks a trial as "just asked about" — transient pulse-fade card highlight, self-clears; never touches selection/pills. */
  markTrialAsked: (trialId: string) => void;
  /** Clears the "being asked" set — called by TrialPanel.tsx ~1.5s after the chat run finishes. */
  clearAskedTrials: () => void;
  /** Bridge hook for the Chat tool-result watcher — not for direct UI use. */
  ingestChatToolResult: (
    criteria: TrialSearchCriteria,
    trials: Trial[],
    opts: {
      isNewSearch: boolean;
      total?: number;
      totalPages?: number;
      page?: number;
    }
  ) => void;
};

const TrialSearchContext = createContext<TrialSearchApi | null>(null);

async function callTrialSearchApi(
  criteria: TrialSearchCriteria,
  sort: TrialSearchSort | undefined,
  page: number,
  pageSize: number,
  signal: AbortSignal
) {
  const res = await fetch("/api/trial-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ criteria, sort, page, pageSize }),
    signal,
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? "Trial search failed");
  }
  return data as {
    trials: Trial[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages?: number;
      hasNextPage: boolean;
    };
  };
}

export function TrialSearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState<TrialSearchState>(createIdleTrialSearch());
  const [panelOpen, setPanelOpen] = useState(false);
  const userClosedPanelRef = useRef(false);

  // Search history (spec section 17): snapshots of past *active* searches,
  // pushed only on true new-search transitions (never on refine/paginate/
  // sort). Kept as a ref-mirrored value so `runSearch`/`ingestChatToolResult`
  // can read "the search about to be replaced" without depending on
  // `search` in their own useCallback deps (which would recreate them on
  // every keystroke-driven update).
  const [searchHistory, setSearchHistory] = useState<TrialSearchState[]>([]);
  const currentSearchRef = useRef(search);
  currentSearchRef.current = search;
  const MAX_HISTORY = 10;
  const pushToHistoryIfNewSearch = useCallback((isNewSearch: boolean) => {
    if (!isNewSearch) return;
    const prev = currentSearchRef.current;
    if (prev.status === "idle") return;
    setSearchHistory((h) => [...h, prev].slice(-MAX_HISTORY));
  }, []);

  // Stale-request protection: only the latest request may commit its
  // result into state.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const openPanel = useCallback(() => {
    userClosedPanelRef.current = false;
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    userClosedPanelRef.current = true;
    setPanelOpen(false);
  }, []);

  const runSearch = useCallback(
    async (
      criteria: TrialSearchCriteria,
      opts: {
        sort?: TrialSearchSort;
        page: number;
        pageSize: number;
        isNewSearch: boolean;
        source: TrialSearchSource;
        append?: boolean;
      }
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const myRequestId = ++requestIdRef.current;

      pushToHistoryIfNewSearch(opts.isNewSearch);

      setSearch((prev) => ({
        ...prev,
        id: opts.isNewSearch ? createSearchId() : prev.id,
        criteria,
        sort: opts.sort ?? prev.sort,
        status: opts.append ? "loading-more" : "searching",
        pagination: { ...prev.pagination, page: opts.page, pageSize: opts.pageSize },
      }));

      try {
        const data = await callTrialSearchApi(
          criteria,
          opts.sort,
          opts.page,
          opts.pageSize,
          controller.signal
        );

        // Stale-request guard: a newer request already started.
        if (myRequestId !== requestIdRef.current) return;

        setSearch((prev) => ({
          ...prev,
          results: opts.append ? [...prev.results, ...data.trials] : data.trials,
          pagination: {
            page: data.pagination.page,
            pageSize: data.pagination.pageSize,
            total: data.pagination.total,
            totalPages: data.pagination.totalPages,
            hasNextPage: data.pagination.hasNextPage,
          },
          status: "success",
          error: undefined,
          updatedAt: new Date().toISOString(),
        }));

        // Panel open/close rules (see spec section 8): auto-open on first
        // successful search or on a genuinely new search; preserve the
        // user's current open/closed preference on a refinement.
        if (opts.isNewSearch && !userClosedPanelRef.current) {
          setPanelOpen(true);
        } else if (opts.isNewSearch) {
          // A brand-new search always opens the panel, overriding a prior
          // manual close (new topic = new context worth surfacing).
          userClosedPanelRef.current = false;
          setPanelOpen(true);
        }
      } catch (error) {
        if (myRequestId !== requestIdRef.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearch((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Trial search failed",
        }));
      }
    },
    [pushToHistoryIfNewSearch]
  );

  const startNewTrialSearch = useCallback(
    async (criteria: TrialSearchCriteria, source: TrialSearchSource = "panel") => {
      await runSearch(criteria, {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        isNewSearch: true,
        source,
      });
    },
    [runSearch]
  );

  const updateTrialSearch = useCallback(
    async (patch: Partial<TrialSearchCriteria>, source: TrialSearchSource = "panel") => {
      const nextCriteria = { ...search.criteria, ...patch };
      await runSearch(nextCriteria, {
        sort: search.sort,
        page: 1,
        pageSize: search.pagination.pageSize || DEFAULT_PAGE_SIZE,
        isNewSearch: false,
        source,
      });
    },
    [runSearch, search.criteria, search.sort, search.pagination.pageSize]
  );

  const updateTrialSearchSort = useCallback(
    async (sort: TrialSearchSort) => {
      await runSearch(search.criteria, {
        sort,
        page: 1,
        pageSize: search.pagination.pageSize || DEFAULT_PAGE_SIZE,
        isNewSearch: false,
        source: "panel",
      });
    },
    [runSearch, search.criteria, search.pagination.pageSize]
  );

  const loadNextTrialSearchPage = useCallback(async () => {
    if (!search.pagination.hasNextPage) return;
    await runSearch(search.criteria, {
      sort: search.sort,
      page: search.pagination.page + 1,
      pageSize: search.pagination.pageSize || DEFAULT_PAGE_SIZE,
      isNewSearch: false,
      source: "panel",
      append: true,
    });
  }, [runSearch, search.criteria, search.sort, search.pagination]);

  const toggleTrialSelection = useCallback((trialId: string) => {
    setSearch((prev) => {
      const current = prev.selectedTrialIds ?? [];
      const alreadySelected = current.includes(trialId);
      if (alreadySelected) {
        return { ...prev, selectedTrialIds: current.filter((id) => id !== trialId) };
      }
      if (current.length >= MAX_SELECTED_TRIALS) return prev;
      return { ...prev, selectedTrialIds: [...current, trialId] };
    });
  }, []);

  /**
   * `askedTrialIds` tracks which trial(s) are being asked about for the
   * *current* chat run — lifecycle is owned by TrialPanel.tsx (which
   * watches `thread.isRunning` and clears this ~1.5s after the run
   * finishes), not a fixed setTimeout fired at click time. This function
   * only sets the flag; callers decide when to clear it.
   */
  const markTrialAsked = useCallback((trialId: string) => {
    setSearch((prev) => ({
      ...prev,
      askedTrialIds: prev.askedTrialIds?.includes(trialId)
        ? prev.askedTrialIds
        : [...(prev.askedTrialIds ?? []), trialId],
    }));
  }, []);

  const clearAskedTrials = useCallback(() => {
    setSearch((prev) =>
      prev.askedTrialIds?.length ? { ...prev, askedTrialIds: [] } : prev
    );
  }, []);

  // Called by the Chat tool-result bridge once the `trial_search` tool
  // resolves — bypasses the network call (the agent already did it) but
  // otherwise follows the same state-update + panel-open rules.
  const ingestChatToolResult = useCallback(
    (
      criteria: TrialSearchCriteria,
      trials: Trial[],
      opts: {
        isNewSearch: boolean;
        total?: number;
        totalPages?: number;
        page?: number;
      }
    ) => {
      const myRequestId = ++requestIdRef.current;
      pushToHistoryIfNewSearch(opts.isNewSearch);
      setSearch((prev) => ({
        ...prev,
        id: opts.isNewSearch ? createSearchId() : prev.id,
        criteria,
        results: trials,
        pagination: {
          page: opts.page ?? 1,
          pageSize: prev.pagination.pageSize || DEFAULT_PAGE_SIZE,
          total: opts.total ?? trials.length,
          totalPages: opts.totalPages,
          hasNextPage:
            typeof opts.totalPages === "number"
              ? (opts.page ?? 1) < opts.totalPages
              : false,
        },
        status: "success",
        error: undefined,
        updatedAt: new Date().toISOString(),
      }));
      if (myRequestId !== requestIdRef.current) return;
      if (opts.isNewSearch) userClosedPanelRef.current = false;
      if (!userClosedPanelRef.current) setPanelOpen(true);
    },
    [pushToHistoryIfNewSearch]
  );

  const value = useMemo<TrialSearchApi>(
    () => ({
      search,
      searchHistory,
      panelOpen,
      openPanel,
      closePanel,
      startNewTrialSearch,
      updateTrialSearch,
      updateTrialSearchSort,
      loadNextTrialSearchPage,
      toggleTrialSelection,
      markTrialAsked,
      clearAskedTrials,
      ingestChatToolResult,
    }),
    [
      search,
      searchHistory,
      panelOpen,
      openPanel,
      closePanel,
      startNewTrialSearch,
      updateTrialSearch,
      updateTrialSearchSort,
      loadNextTrialSearchPage,
      toggleTrialSelection,
      markTrialAsked,
      clearAskedTrials,
      ingestChatToolResult,
    ]
  );

  return (
    <TrialSearchContext.Provider value={value}>
      {children}
    </TrialSearchContext.Provider>
  );
}

export function useTrialSearch(): TrialSearchApi {
  const ctx = useContext(TrialSearchContext);
  if (!ctx) {
    throw new Error("useTrialSearch must be used within a TrialSearchProvider");
  }
  return ctx;
}
