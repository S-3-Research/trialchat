"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  toPersistedTrialSearch,
  type PersistedTrialSearch,
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

import { LatestThreadSaveQueue } from "@/lib/latestThreadSaveQueue";

type TrialSearchSource = "chat" | "panel";

export type TrialPersistenceStatus = "idle" | "saving" | "saved" | "error";

/**
 * Injected by AssistantPanel.tsx once a thread id is known (never present
 * for a brand-new, not-yet-created thread). Saves the *current* search
 * directly into the LangGraph thread's checkpoint — independent of
 * whether a chat turn ever runs — so Panel-only edits (filters, sort,
 * pagination, selection) survive a thread switch/reload per the
 * thread-scoped persistence spec (section 3: "do not wait for page
 * close/thread switch to save").
 */
export type TrialSearchPersistenceAdapter = {
  save: (payload: PersistedTrialSearch, opts: { signal: AbortSignal }) => Promise<void>;
};

type TrialSearchApi = {
  search: TrialSearchState;
  /**
   * The thread key `search` currently belongs to (mirrors the `threadKey`
   * prop passed into the Provider). Exposed so consumers that read
   * `search` from OUTSIDE this Provider's own reset-effect machinery
   * (e.g. TrialSearchChatBridge.tsx, which also has its own `aui`-derived
   * notion of "current thread") can guard against acting on `search` while
   * it's still momentarily the OLD thread's data during a switch — see
   * `searchOwnerThreadKeyRef`'s doc comment in the Provider for the full
   * race-condition rationale.
   */
  threadKey: string;
  persistenceStatus: TrialPersistenceStatus;
  /**
   * True while AssistantPanel is fetching this thread's persisted Trial
   * Panel state from its checkpoint — lets the Panel show a skeleton
   * instead of either a stale previous thread's content or a blank/idle
   * flash while the network round-trip is in flight. Always `false` for
   * a brand-new thread (see AssistantPanel.tsx).
   */
  isHydrating: boolean;
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
    source?: TrialSearchSource,
    sort?: TrialSearchSort
  ) => Promise<void>;
  updateTrialSearch: (
    patch: Partial<TrialSearchCriteria>,
    source?: TrialSearchSource,
    sort?: TrialSearchSort
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
      toolCallId?: string;
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

export function TrialSearchProvider({
  children,
  threadKey,
  initialState,
  persistenceAdapter,
  isHydrating,
}: {
  children: ReactNode;
  /**
   * Stable identity of the thread currently being viewed (AssistantPanel's
   * `activeThreadKey`, i.e. `threadListItem.id`, or a fixed sentinel like
   * "new" when there is none). The Provider is NO LONGER remounted (keyed)
   * on this value — that used to reset `panelOpen` to `false` on every
   * genuine thread switch, producing a visible collapse+reopen ("slide")
   * animation. Instead this is a plain prop: an effect keyed on it (a)
   * flushes any not-yet-saved edit for the OLD thread using the OLD
   * `persistenceAdapter` (via closure) and (b) resets `search` to the NEW
   * thread's `initialState`, while deliberately leaving `panelOpen` alone.
   */
  threadKey: string;
  /**
   * Hydrated Trial Panel state for the thread currently being opened —
   * see AssistantPanel.tsx's `load()` callback / TrialThreadSync, which
   * reads it back out of the thread's LangGraph checkpoint via
   * `fromPersistedTrialSearch`. Only consulted when `threadKey` actually
   * changes (see the reset effect below), not on every render.
   */
  initialState?: TrialSearchState;
  persistenceAdapter?: TrialSearchPersistenceAdapter;
  /** See `isHydrating` on `TrialSearchApi` above. */
  isHydrating?: boolean;
}) {
  const [search, setSearch] = useState<TrialSearchState>(
    () => initialState ?? createIdleTrialSearch()
  );
  // Deliberately NOT reset when `threadKey` changes — see the `threadKey`
  // comment above. Preserving this across thread switches is what fixes
  // the reported "panel slides on every switch" bug.
  const [panelOpen, setPanelOpen] = useState(false);
  const userClosedPanelRef = useRef(false);
  const [persistenceStatus, setPersistenceStatus] =
    useState<TrialPersistenceStatus>("idle");

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

      // Reset any leftover selection-toggle debounce (see `saveDelayRef`'s
      // comment above) — an Edit-filters/sort/paginate action is already
      // gated behind an explicit user action, so its resulting save should
      // never inherit a stale 150ms delay from an earlier card click.
      saveDelayRef.current = 0;

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
    async (criteria: TrialSearchCriteria, source: TrialSearchSource = "panel", sort: TrialSearchSort = "relevance") => {
      await runSearch(criteria, {
        sort,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        isNewSearch: true,
        source,
      });
    },
    [runSearch]
  );

  const updateTrialSearch = useCallback(
    async (patch: Partial<TrialSearchCriteria>, source: TrialSearchSource = "panel", sort?: TrialSearchSort) => {
      const nextCriteria = { ...search.criteria, ...patch };
      await runSearch(nextCriteria, {
        sort: sort ?? search.sort,
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
    // The only mutator with no "Apply"-style gate — a user can click several
    // cards in a row, so give the persistence save a brief debounce here
    // (see `saveDelayRef`'s comment above) instead of saving on every click.
    saveDelayRef.current = 150;
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

  // --- Thread-scoped persistence ------------------------------------
  //
  // Saves the *settled* search (never mid-flight "searching"/
  // "loading-more" states in the debounced path — those are about to be
  // replaced by their own result anyway) directly into the thread's
  // LangGraph checkpoint, independent of whether a chat turn ever runs.
  // Debounced so rapid Panel edits (e.g. dragging an age slider) don't
  // fire a save per keystroke; deduped by signature so re-renders that
  // don't actually change the persisted fields never re-save.
  //
  // A separate baseline for each thread prevents cross-thread deduplication.
  const persistedSignaturesRef = useRef<Map<string, string | null>>(
    new Map(
      initialState
        ? [[threadKey, JSON.stringify(toPersistedTrialSearch(initialState))]]
        : []
    )
  );

  // Only committed effects update ownership; abandoned concurrent renders
  // must not change which thread an adapter or an async result belongs to.
  const searchOwnerThreadKeyRef = useRef(threadKey);
  const [prevThreadKey, setPrevThreadKey] = useState(threadKey);

  // How long the debounced-save effect below should wait before saving the
  // *next* `search` change. Most mutations (Edit-filters submit, sort,
  // pagination, Chat-ingested results) are already throttled upstream by
  // requiring an explicit user action (e.g. clicking "Apply"), so there's
  // nothing left to debounce — save immediately (0ms) so persistence feels
  // as responsive as the rest of the UI. Only `toggleTrialSelection` (which
  // fires on every card click with no "Apply" gate, and a user may click
  // several cards in quick succession) sets this to a short debounce right
  // before its own `setSearch` call.
  const saveDelayRef = useRef(0);

  const currentPersistenceAdapterRef = useRef(persistenceAdapter);

  // Shared save path used by both the debounced-save effect and the
  // thread-switch flush effect below — skips if there's nothing to save,
  // nothing changed since the last save, or `status` is one not worth
  // persisting; otherwise saves and updates the signature baseline.
  const [saveQueue] = useState(() => new LatestThreadSaveQueue());
  const trySave = useCallback(
    (
      adapter: TrialSearchPersistenceAdapter | undefined,
      current: TrialSearchState,
      allowInFlight: boolean,
      forThreadKey: string,
    ) => {
      if (!adapter) return;
      const skippableStatus = allowInFlight ? current.status === "idle" : current.status !== "success" && current.status !== "error";
      if (skippableStatus) return;
      const payload = toPersistedTrialSearch(current);
      const signature = JSON.stringify(payload);
      if (!saveQueue.hasPending(forThreadKey) && signature === (persistedSignaturesRef.current.get(forThreadKey) ?? null)) return;
      if (searchOwnerThreadKeyRef.current === forThreadKey) setPersistenceStatus("saving");
      saveQueue.enqueue(forThreadKey, signature, () =>
        adapter.save(payload, { signal: new AbortController().signal })
      ).then((isLatest) => {
        if (!isLatest) return;
        persistedSignaturesRef.current.set(forThreadKey, signature);
        if (searchOwnerThreadKeyRef.current === forThreadKey) setPersistenceStatus("saved");
      }).catch((error) => {
        console.error("[TrialSearchContext] Failed to persist trial state:", error);
        if (searchOwnerThreadKeyRef.current === forThreadKey) setPersistenceStatus("error");
      });
    },
    [saveQueue]
  );

  useEffect(() => {
    if (!persistenceAdapter) return;
    if (prevThreadKey !== threadKey || searchOwnerThreadKeyRef.current !== threadKey) return;
    if (search.status !== "success" && search.status !== "error") return;
    const payload = toPersistedTrialSearch(search);
    if (!saveQueue.hasPending(threadKey) && JSON.stringify(payload) === (persistedSignaturesRef.current.get(threadKey) ?? null)) return;

    const timer = setTimeout(
      () => trySave(persistenceAdapter, search, false, threadKey),
      saveDelayRef.current
    );
    return () => clearTimeout(timer);
  }, [search, persistenceAdapter, trySave, threadKey, prevThreadKey, saveQueue]);

  // Reset only after commit. Until this layout effect applies the new
  // snapshot, consumers receive the OLD owner key and a loading flag, so
  // a new thread's tool messages cannot mutate the old search.
  useLayoutEffect(() => {
    if (prevThreadKey !== threadKey) {
      trySave(currentPersistenceAdapterRef.current, search, true, prevThreadKey);
      abortRef.current?.abort();
      requestIdRef.current++;
      searchOwnerThreadKeyRef.current = threadKey;
      setPrevThreadKey(threadKey);
      setSearch(initialState ?? createIdleTrialSearch());
      persistedSignaturesRef.current.set(
        threadKey,
        initialState ? JSON.stringify(toPersistedTrialSearch(initialState)) : null
      );
      setPersistenceStatus("idle");
      setSearchHistory([]);
    }
    currentPersistenceAdapterRef.current = persistenceAdapter;
  }, [threadKey, prevThreadKey, initialState, persistenceAdapter, search, trySave]);

  // "Saved" is a transient confirmation, not a permanent status — fade
  // back to idle a couple seconds after a successful save.
  useEffect(() => {
    if (persistenceStatus !== "saved") return;
    const timer = setTimeout(() => setPersistenceStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [persistenceStatus]);

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
        toolCallId?: string;
        total?: number;
        totalPages?: number;
        page?: number;
      }
    ) => {
      const myRequestId = ++requestIdRef.current;
      // Same rationale as `runSearch` above — Chat-driven results should
      // save immediately, not inherit a stale selection-toggle debounce.
      saveDelayRef.current = 0;
      pushToHistoryIfNewSearch(opts.isNewSearch);
      setSearch((prev) => ({
        ...prev,
        id: opts.isNewSearch ? createSearchId() : prev.id,
        criteria,
        lastAppliedToolCallId: opts.toolCallId ?? prev.lastAppliedToolCallId,
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
      threadKey: prevThreadKey,
      persistenceStatus,
      isHydrating: !!isHydrating || prevThreadKey !== threadKey,
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
      threadKey,
      prevThreadKey,
      persistenceStatus,
      isHydrating,
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
