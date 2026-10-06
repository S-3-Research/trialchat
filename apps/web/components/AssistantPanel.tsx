"use client";

import type { ThreadContextScope } from "@/lib/bookmarks";
import { BookmarkSnapshotPanel } from "@/components/bookmarks/BookmarkSnapshotPanel";
import { PanelRight, PanelRightClose, Maximize2, Minimize2, MessageSquareText } from "lucide-react";
import { ThreadNavigation, ThreadScopeHeader } from "@/components/bookmarks/ThreadScope";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssistantRuntimeProvider, ThreadListPrimitive, useAui, useAuiState } from "@assistant-ui/react";
import {
  unstable_createLangGraphStream,
  useLangGraphRuntime,
  type LangChainMessage,
  type UIMessage,
} from "@assistant-ui/react-langgraph";
import { History, Plus, X } from "lucide-react";
import { createAgentClient, AGENT_ASSISTANT_ID } from "@/lib/agentClient";
import { debugAgentStream } from "@/lib/debugAgentStream";
import { createThreadListAdapter } from "@/lib/threadListAdapter";
import { getOrCreateGuestUserId } from "@/lib/guestId";
import { ChatSurface } from "@/components/assistant-ui/ChatSurface";
import { ThreadListSidebar } from "@/components/assistant-ui/ThreadListSidebar";
import { SuggestionsWidget } from "@/components/assistant-ui/tool-ui";
import { TrialSearchChatBridge } from "@/components/assistant-ui/TrialSearchChatBridge";
import { withUserContext } from "@/lib/withUserContext";
import { IntakeFormModal } from "@/components/IntakeFormModal";
import { MatchProfileModal } from "@/components/MatchProfileModal";
import type { MatchProfile } from "@/components/MatchProfileModal";
import { ClinicianModal } from "@/components/ClinicianModal";
import { TrialPanel } from "@/components/assistant-ui/TrialPanel";
import { PANEL_PADDING_X } from "@/components/assistant-ui/TrialPanelShell";
import {
  TrialSearchProvider,
  useTrialSearch,
  type TrialSearchPersistenceAdapter,
} from "@/contexts/TrialSearchContext";
import {
  fromPersistedTrialSearch,
  type PersistedTrialSearch,
  type TrialSearchState,
} from "@/lib/types/trialSearch";
import {
  PLACEHOLDER_INPUT,
  getGreetingForUser,
  getStarterPromptsForUser,
} from "@/lib/config";
import { toChatStarterPrompts } from "@/lib/types/prompts";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Tooltip } from "@/components/ui/Tooltip";
import { INTAKE_STORAGE_KEY, type IntakeData } from "@/lib/types/intake";
import { useVoiceInputMode } from "@/contexts/VoiceInputModeContext";
import {
  createWebSpeechDictationAdapter,
  WhisperDictationAdapter,
} from "@/lib/voiceDictationAdapters";

/**
 * Chat is now the SECONDARY, collapsible surface (the Trial Panel is the
 * persistent main one — see AssistantPanelBody below), so these width
 * constants — previously owned by TrialPanel.tsx — now describe the chat
 * column instead: a percentage of the overall container for the desktop
 * docked column, and a near-full-width overlay sheet on mobile.
 */
const CHAT_PANEL_WIDTH_PERCENT = 36;
const CHAT_PANEL_MOBILE_WIDTH = "min(92%, 30rem)";


/**
 * LangGraph-backed chat panel with personalized starter prompts and a
 * conversation sidebar backed by LangGraph Server thread storage — see
 * lib/threadListAdapter.ts.
 *
 * Talks to apps/agent through the same-origin /api/agent proxy (see
 * app/api/agent/[...path]/route.ts). Theme (dark/light) and font size are
 * handled entirely by the existing ColorSchemeContext / FontSizeContext
 * (both operate on <html>, independent of which chat UI is mounted), so no
 * extra wiring is needed here.
 */
export function AssistantPanel() {
  const client = useMemo(() => createAgentClient(), []);
  const isMobile = useIsMobile();
  const [intakeData, setIntakeData] = useState<IntakeData | null>(null);
  // Mirrors `intakeData` for `stream`'s withUserContext getter (see above),
  // which must read the *current* value without `stream` depending on
  // `intakeData` directly (that would recreate `stream`/`runtime` on every
  // intake change, tearing down the active run).
  const intakeDataRef = useRef<IntakeData | null>(null);
  intakeDataRef.current = intakeData;
  // Stable runtime slot identity owns the Panel state; the remote id only
  // selects its persistence endpoint. Assigning a new chat its remote id
  // must not discard edits made before its first message.
  const [activeThread, setActiveThread] = useState<{
    key?: string;
    remoteId?: string;
    trialState?: TrialSearchState;
    contextScope?: ThreadContextScope;
    error?: string;
  }>({});
  const { key: activeThreadKey, remoteId: activeRemoteId, trialState: hydratedTrialState } = activeThread;
  // True while TrialThreadSync is fetching the newly-selected thread's
  // Trial Panel state from the server — lets the Panel show a lightweight
  // skeleton instead of a stale previous-thread flash while the
  // `getState` round-trip is in flight. There is deliberately NO client
  // cache here (see TrialThreadSync below): every switch re-fetches from
  // the LangGraph checkpoint, which is the only authoritative source and
  // avoids an in-memory snapshot ever going stale relative to it.
  const [isHydratingTrialState, setIsHydratingTrialState] = useState(false);

  // Writes the current search straight into the thread's LangGraph
  // checkpoint (bypassing the "rides the next run" staging that
  // TrialSearchChatBridge uses for per-turn model context) so Panel-only
  // edits are never lost if the user switches threads without sending
  // another chat message (spec section 3).
  const persistenceAdapter = useMemo<TrialSearchPersistenceAdapter | undefined>(() => {
    if (!activeRemoteId || activeThread.contextScope || activeThread.error) return undefined;
    return {
      save: async (payload: PersistedTrialSearch, { signal }) => {
        await client.threads.updateState(activeRemoteId, {
          values: { activeTrialSearch: payload },
          signal,
        });
      },
    };
  }, [client, activeRemoteId, activeThread.contextScope, activeThread.error]);

  // Whether the intake form (goal/role/tone) still needs to be shown —
  // shown on the first visit unless the matching entry point skips it. `null` means "not checked yet" (avoids a flash of the modal
  // before the initial localStorage read resolves).
  const [showIntakeModal, setShowIntakeModal] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(INTAKE_STORAGE_KEY);
    if (!stored) {
      setShowIntakeModal(new URLSearchParams(window.location.search).get("skip_intake") !== "1");
      return;
    }
    try {
      setIntakeData(JSON.parse(stored));
      setShowIntakeModal(false);
    } catch (error) {
      console.error("[AssistantPanel] Failed to parse intake data:", error);
      setShowIntakeModal(true);
    }
  }, []);

  // Re-show the intake form after a clinician exits clinician mode (Header's
  // banner dispatches this once it clears localStorage) so the user can
  // re-select a role.
  useEffect(() => {
    const handleClinicianModeExited = () => {
      setIntakeData(null);
      setShowIntakeModal(true);
    };
    window.addEventListener("clinician-mode-exited", handleClinicianModeExited);
    return () => window.removeEventListener("clinician-mode-exited", handleClinicianModeExited);
  }, []);

  const handleIntakeComplete = (data: IntakeData) => {
    setIntakeData(data);
    setShowIntakeModal(false);
    window.dispatchEvent(new CustomEvent("intake-role-updated"));
  };

  const greeting = getGreetingForUser(intakeData);
  const prompts = toChatStarterPrompts(
    getStarterPromptsForUser(intakeData),
    isMobile
  );

  const { mode: voiceInputMode } = useVoiceInputMode();
  const dictation = useMemo(
    () =>
      voiceInputMode === "whisper"
        ? new WhisperDictationAdapter()
        : createWebSpeechDictationAdapter(),
    [voiceInputMode]
  );

  const stream = useMemo(
    () =>
      withUserContext(
        debugAgentStream(unstable_createLangGraphStream({
          client,
          assistantId: AGENT_ASSISTANT_ID,
          // Use the native message tuple stream so streamed chunks and the
          // final reply share a stable ID with the attached suggestions UI.
          streamMode: ["messages-tuple", "updates", "custom"],
        })),
        // Read from the ref (not the `intakeData` state var) so this getter
        // always sees the latest value without needing `stream` itself to
        // be recreated on every intake change — see withUserContext.ts.
        () =>
          intakeDataRef.current
            ? {
                role: intakeDataRef.current.role,
                intent: intakeDataRef.current.intent,
                response_style: intakeDataRef.current.response_style,
              }
            : null
      ),
    [client]
  );

  const threadListAdapter = useMemo(
    () => createThreadListAdapter(client, getOrCreateGuestUserId()),
    [client]
  );

  const runtime = useLangGraphRuntime({
    unstable_allowCancellation: true,
    unstable_threadListAdapter: threadListAdapter,
    stream,
    adapters: { dictation },
    // Generative UI: the agent's `suggestions_agent` node explicitly emits
    // a named `{ name: "suggestions", props }` UI message via
    // `typedUi(config).push(...)` (see apps/agent/src/nodes/suggestions.ts)
    // bound to the assistant message it follows up on — this registers the
    // React component that renders it wherever assistant-ui slots "data"
    // message parts in, no per-message wiring needed in thread.tsx.
    uiComponents: {
      renderers: { suggestions: SuggestionsWidget },
    },
    load: async (externalId) => {
      const state = await client.threads.getState<{
        messages: LangChainMessage[];
        ui?: UIMessage[];
      }>(externalId);
      return {
        messages: state.values.messages ?? [],
        uiMessages: state.values.ui ?? [],
        interrupts: state.tasks[0]?.interrupts,
      };
    },
  });

  return (
    <div className="relative flex flex-1 w-full h-full mx-auto max-w-7xl rounded-[32px] overflow-hidden border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-[#181D26] shadow-[0_30px_70px_-24px_rgba(30,41,59,0.25)] dark:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.6)] transition-colors">
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadNavigation enabled={showIntakeModal !== null} />
        {showIntakeModal && (
          <IntakeFormModal onComplete={handleIntakeComplete} />
        )}
        <TrialThreadSync
          client={client}
          onThreadSwitch={(key, remoteId, trialState, contextScope, error) => {
            // TrialThreadSync follows the runtime's actual selection, including
            // New Chat, deletion and programmatic navigation. Its fetch generation
            // guard discards responses belonging to a previous selection.
            setActiveThread({ key, remoteId, trialState, contextScope, error });
          }}
          onRemoteIdAssigned={(key, remoteId) => {
            // Guard: ignore a late-arriving assignment for a thread key the
            // user has already switched away from.
            setActiveThread((current) =>
              current.key === key ? { ...current, remoteId } : current
            );
          }}
          onHydratingChange={setIsHydratingTrialState}
        />
          <TrialSearchProvider
            threadKey={activeThreadKey ?? "new"}
            initialState={hydratedTrialState}
            persistenceAdapter={persistenceAdapter}
            isHydrating={isHydratingTrialState}
          >
            <AssistantPanelBody
              activeThreadKey={activeThreadKey}
              contextScope={activeThread.contextScope}
              hydrationError={activeThread.error}
              isMobile={isMobile}
              greeting={greeting}
              prompts={prompts}
              intakeData={intakeData}
            />
          </TrialSearchProvider>
      </AssistantRuntimeProvider>
    </div>
  );
}

/** Hydrates the actual runtime selection, including New Chat and deletion. */
function TrialThreadSync({
  client,
  onThreadSwitch,
  onRemoteIdAssigned,
  onHydratingChange,
}: {
  client: ReturnType<typeof createAgentClient>;
  onThreadSwitch: (
    key: string | undefined,
    remoteId: string | undefined,
    trialState: TrialSearchState | undefined,
    contextScope?: ThreadContextScope,
    error?: string
  ) => void;
  onRemoteIdAssigned: (key: string, remoteId: string) => void;
  onHydratingChange: (isHydrating: boolean) => void;
}) {
  const id = useAuiState((s) => s.optional.threadListItem?.id);
  const remoteId = useAuiState((s) => s.optional.threadListItem?.remoteId);

  const remoteIdRef = useRef(remoteId);
  remoteIdRef.current = remoteId;
  const onThreadSwitchRef = useRef(onThreadSwitch);
  onThreadSwitchRef.current = onThreadSwitch;
  const onRemoteIdAssignedRef = useRef(onRemoteIdAssigned);
  onRemoteIdAssignedRef.current = onRemoteIdAssigned;
  const onHydratingChangeRef = useRef(onHydratingChange);
  onHydratingChangeRef.current = onHydratingChange;

  // Fires only when `id` changes (i.e. a genuine thread switch) — reads
  // whatever `remoteId` happens to be current *at that moment* via the ref
  // above rather than depending on it directly, which is what keeps this
  // effect from re-running merely because `remoteId` gets assigned later
  // for the same thread (see `onRemoteIdAssigned` below for that case).
  const seqRef = useRef(0);
  useEffect(() => {
    const seq = ++seqRef.current;
    onHydratingChangeRef.current(false);
    if (!id) {
      onThreadSwitchRef.current(undefined, undefined, undefined);
      return;
    }
    const currentRemoteId = remoteIdRef.current;
    if (!currentRemoteId) {
      // Brand-new, not-yet-initialized thread — nothing to hydrate yet.
      onThreadSwitchRef.current(id, undefined, fromPersistedTrialSearch(undefined));
      return;
    }
    // Race guard (spec section 11): if the user switches threads again
    // before this resolves, only the *latest* fetch may hydrate the Trial
    // Panel — an older, now-stale response must never clobber the Panel
    // state of the thread the user is actually looking at.
    let cancelled = false;
    onHydratingChangeRef.current(true);
    client.threads
      .getState<{ activeTrialSearch?: PersistedTrialSearch; contextScope?: ThreadContextScope }>(currentRemoteId)
      .then((state) => {
        if (cancelled || seq !== seqRef.current) return;
        const scope = state.values.contextScope;
        const frozen = scope?.type === "bookmark_full_snapshot" || scope?.type === "bookmark_picked_snapshot";
        const trialState = fromPersistedTrialSearch(frozen ? undefined : state.values.activeTrialSearch);
        onHydratingChangeRef.current(false);
        onThreadSwitchRef.current(id, currentRemoteId, trialState, scope);
      })
      .catch((error) => {
        if (cancelled || seq !== seqRef.current) return;
        console.error("[TrialThreadSync] Failed to load trial state for thread:", error);
        onHydratingChangeRef.current(false);
        // Still switch the Provider to this thread (empty/idle state) so the
        // Panel doesn't keep showing a stale, different thread's search.
        onThreadSwitchRef.current(id, currentRemoteId, undefined, undefined, "Could not load this conversation’s trials. Reload to retry.");
      });
    return () => {
      cancelled = true;
    };
  }, [client, id]);

  // Fires when `remoteId` becomes available (or changes) for whatever `id`
  // is current — covers the "brand-new thread just got its first message,
  // so it now has a real server-side id" case. Does NOT re-hydrate or
  // remount anything; the Provider's live `search` state already reflects
  // reality, this just unlocks `persistenceAdapter` in the parent so the
  // next debounced-save effect run (which depends on `persistenceAdapter`,
  // see TrialSearchContext.tsx) can actually persist it.
  useEffect(() => {
    if (!id || !remoteId) return;
    onRemoteIdAssignedRef.current(id, remoteId);
  }, [id, remoteId]);

  return null;
}

function AssistantPanelBody({
  activeThreadKey,
  contextScope,
  hydrationError,
  isMobile,
  greeting,
  prompts,
  intakeData,
}: {
  activeThreadKey?: string;
  contextScope?: ThreadContextScope;
  hydrationError?: string;
  isMobile: boolean;
  greeting: string;
  prompts: ReturnType<typeof toChatStarterPrompts>;
  intakeData: IntakeData | null;
}) {
  const { panelOpen: trialPanelOpen, openPanel, isHydrating, search } = useTrialSearch();
  const runtimeKey = useAuiState((s) => s.optional.threadListItem?.id);
  const loading = isHydrating || runtimeKey !== activeThreadKey;
  const scope = !loading && contextScope && contextScope.type !== "trial_search" ? contextScope : undefined;

  // Unified desktop layout state (spec: Trial Panel + Chat default to a
  // side-by-side "dual" layout; either one can take over the whole
  // surface via its own fullscreen toggle — matchCTA lands in "dual",
  // eduCTA lands directly in "chat-full", see the `open_chat`/`open_match`
  // URL params below). Deliberately a single enum rather than independent
  // booleans so "both fullscreen at once" is structurally unrepresentable.
  const [layoutMode, setLayoutMode] = useState<"dual" | "trial-full" | "chat-full">("dual");
  // Bookmark-snapshot threads are always dual — fullscreen only makes
  // sense for the regular Trial Panel/Chat pair, so scope entry forces
  // (and locks) the layout back to "dual" instead of leaving a stale
  // fullscreen state the user can't easily recover from.
  const lockDual = !!scope;
  useEffect(() => {
    if (lockDual) setLayoutMode("dual");
  }, [lockDual]);
  const showTrial = !lockDual && layoutMode === "chat-full" ? false : true;
  const showChat = !lockDual && layoutMode === "trial-full" ? false : true;
  const isTrialFullscreen = !lockDual && layoutMode === "trial-full";
  const isChatFullscreen = !lockDual && layoutMode === "chat-full";

  // Search History is a left-anchored drawer, independent of layoutMode:
  // in "dual" it's an inline column that pushes Chat into an icon rail
  // (Trial Panel keeps its width); in either fullscreen mode there's only
  // one panel on screen, so it floats as a scrim+overlay instead.
  const [historyOpen, setHistoryOpen] = useState(false);

  // Mobile keeps its own simple mutex (unrelated to desktop's
  // layoutMode/historyOpen — mobile has no dual/fullscreen concept, just
  // the persistent Trial Panel plus two independent left/right sheets).
  const [mobileSheet, setMobileSheet] = useState<"history" | "chat" | null>(null);

  // Opens Chat for the user without caring whether we're on mobile or
  // which desktop layoutMode we're currently in — used wherever the app
  // itself (not a manual header click) needs to surface Chat, e.g. after
  // composing a Match/Clinician message, or a trial card's "Ask" action.
  const openChatForRun = () => {
    if (isMobile) setMobileSheet("chat");
    else if (isTrialFullscreen) setLayoutMode("dual");
  };
  // Inverse: returns to whichever state leaves Chat not the sole focus,
  // without forcibly closing it if it's already just part of the default
  // dual layout.
  const closeChatToDefault = () => {
    if (isMobile) setMobileSheet((current) => (current === "chat" ? null : current));
    else if (isChatFullscreen) setLayoutMode("dual");
  };

  // Trial Panel is now the persistent main surface — ensure it's
  // marked open as soon as this thread's state is ready, rather than
  // relying on the user to open it (it has no collapse control anymore;
  // see TrialPanel.tsx). The bookmark-"scope" snapshot view still owns
  // its own open/close behavior via the same `trialPanelOpen` flag.
  useEffect(() => {
    if (!loading && !scope) openPanel();
  }, [loading, scope, openPanel]);

  // "Screen a patient" modal is still reachable via the homepage's
  // direct matching entry point (the `open_match=1` URL param handled
  // below) even though the standalone "Find matching trials" CTA button
  // has been removed from the floating controls (spec: structured search
  // via the Trial Panel is now the primary path).
  const aui = useAui();
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showClinicianModal, setShowClinicianModal] = useState(false);
  const isClinician = intakeData?.role === "clinician";

  // "Find Your Match"/clinician pre-screen are the one remaining entry
  // point that composes a message and sends it through Chat rather than
  // calling the trial-search API directly (it still needs the LLM to
  // interpret free text into criteria) — unlike a normal chat message,
  // the user never typed anything themselves, so auto-opening Chat while
  // the run is in flight and auto-closing it again once results land
  // keeps the experience feeling like a single Panel action instead of a
  // detour through Chat. Only ever *closes* Chat (never forces it back
  // open if the user already closed it), and only on a genuine new
  // success, not on mount/hydration.
  const [autoCloseChatPending, setAutoCloseChatPending] = useState(false);
  const prevSearchStatusRef = useRef(search.status);
  useEffect(() => {
    if (
      autoCloseChatPending &&
      prevSearchStatusRef.current !== "success" &&
      search.status === "success"
    ) {
      closeChatToDefault();
      setAutoCloseChatPending(false);
    }
    prevSearchStatusRef.current = search.status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.status, autoCloseChatPending]);
  const openedSnapshotRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (scope && !isMobile && openedSnapshotRef.current !== activeThreadKey) {
      openedSnapshotRef.current = activeThreadKey;
      openPanel();
    }
  }, [scope, isMobile, activeThreadKey, openPanel]);
  // Preserve the homepage's direct matching entry point without reopening it
  // when the thread URL changes. Scope hydration must finish first. Also
  // handles the Education CTA's `open_chat=1` — lands directly in
  // "chat-full" (desktop) / the chat sheet (mobile) instead of the default
  // dual layout.
  const entryHandled = useRef(false);
  useEffect(() => {
    if (loading || entryHandled.current) return;
    entryHandled.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get("open_match") === "1" && !scope) {
      openPanel();
      if (isClinician) setShowClinicianModal(true);
      else setShowMatchModal(true);
    } else if (url.searchParams.get("open_chat") === "1" && !scope) {
      if (isMobile) setMobileSheet("chat");
      else setLayoutMode("chat-full");
    }
    url.searchParams.delete("open_match");
    url.searchParams.delete("open_chat");
    url.searchParams.delete("skip_intake");
    window.history.replaceState(window.history.state, "", url);
  }, [loading, scope, isClinician, isMobile, openPanel]);

  // Trial Panel content: this is now the persistent MAIN surface (not a
  // collapsible docked column), so it's rendered in-flow for both desktop
  // and mobile — see the single "main" wrapper below (no more separate
  // docked-column vs. mobile-sheet branches for it). The non-scope case
  // (plain `<TrialPanel>`) is rendered directly in JSX below instead of
  // here, since it needs the header icon row passed in as a prop.
  const panel = loading ? <p role="status" className="p-6 text-sm text-slate-500">Loading conversation trials…</p>
    : hydrationError ? <p role="alert" className="p-6 text-sm text-red-600">{hydrationError}</p>
    : scope ? (trialPanelOpen ? (
        <BookmarkSnapshotPanel
          key={activeThreadKey}
          scope={scope}
          // Same New Search / Search History icon row as the main Trial
          // Panel's header (see TrialPanelHeaderIcons below) — a bookmark
          // snapshot is still just another Trial Panel view, so it
          // shouldn't lose access to those controls. It shows the same
          // (disabled) fullscreen button as the regular Trial Panel/Chat
          // pair for visual consistency — see `fullscreenDisabled` on
          // TrialPanelShell — instead of a separate collapse button.
          headerActions={
            <TrialPanelHeaderIcons
              isMobile={isMobile}
              historyOpen={isMobile ? mobileSheet === "history" : historyOpen}
              onToggleHistory={() =>
                isMobile
                  ? setMobileSheet((v) => (v === "history" ? null : "history"))
                  : setHistoryOpen((v) => !v)
              }
              chatOpen={mobileSheet === "chat"}
              onToggleChat={() => setMobileSheet((v) => (v === "chat" ? null : "chat"))}
            />
          }
        />
      ) : null)
    : null;

  return (
    <>
      {/*
         * Trial Panel — now the persistent MAIN surface (structured
         * search/filters are the primary way to find trials; chat is
         * secondary by default — see `layoutMode` above). Hidden entirely
         * only in "chat-full". The New Search / Search History icon row
         * lives in its own header (passed as `headerActions`); the
         * fullscreen toggle is rendered by TrialPanelShell itself via
         * `onToggleFullscreen`/`isFullscreen`.
         */}
      <div className="relative flex flex-1 min-w-0">
        {/* Search History — left-anchored drawer, independent of
         * layoutMode. In "dual" it's an inline column (pushes Chat into
         * an icon rail, see the Chat column below) that animates its
         * width open/closed exactly like the Chat column's own width
         * transitions below, rather than mounting/unmounting abruptly;
         * its inner content keeps a fixed w-64 so it doesn't reflow
         * mid-transition. Squeeze vs. overlay depends on layoutMode: in
         * "dual" there are already two panels sharing the row, so History
         * floats as a scrim+overlay instead of squeezing either one (see
         * the overlay block further below); in either fullscreen mode
         * there's only a single panel, so History can simply squeeze it
         * inline here without needing a separate icon-rail affordance.
         * Mobile renders its own overlay sheet instead (further below). */}
        {(() => {
          const historyInline = !isMobile && historyOpen && layoutMode !== "dual";
          return (
            <div
              className={`hidden md:flex md:flex-col overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                historyInline ? "border-r border-slate-200/70 dark:border-slate-700/60" : ""
              }`}
              style={{ width: historyInline ? "16rem" : "0" }}
            >
              <SearchHistoryPanelContent onClose={() => setHistoryOpen(false)} />
            </div>
          );
        })()}

        {(() => {
          // Mirrors the Chat column's explicit-percentage-width approach
          // (instead of conditionally mounting/unmounting) so toggling
          // Trial Panel fullscreen animates smoothly instead of snapping.
          // Mobile always gets the full width — Chat is an overlay sheet
          // there, never an inline sibling, so there's nothing to share
          // space with.
          const trialWidthPercent = isMobile
            ? 100
            : layoutMode === "chat-full"
            ? 0
            : layoutMode === "trial-full"
            ? 100
            : 100 - CHAT_PANEL_WIDTH_PERCENT;
          // When History squeezes in inline (fullscreen modes only — see
          // the block above), it claims a fixed 16rem out of the row, so
          // the single "full" panel must shrink by that same amount via
          // calc() instead of staying a flat 100% — otherwise the row's
          // total width exceeds its container and History gets clipped by
          // the outer rounded-[32px] wrapper's overflow-hidden.
          const historyInline = !isMobile && historyOpen && layoutMode !== "dual";
          const trialWidth = isMobile
            ? "100%"
            : historyInline && trialWidthPercent === 100
            ? "calc(100% - 16rem)"
            : `${trialWidthPercent}%`;
          return (
            <div
              className="relative min-w-0 flex flex-col overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ width: trialWidth }}
            >
            {!scope ? (
              <TrialPanel
                onAsk={openChatForRun}
                isFullscreen={!isMobile && isTrialFullscreen}
                onToggleFullscreen={
                  isMobile || lockDual ? undefined : () => setLayoutMode(isTrialFullscreen ? "dual" : "trial-full")
                }
                headerActions={
                  <TrialPanelHeaderIcons
                    isMobile={isMobile}
                    historyOpen={isMobile ? mobileSheet === "history" : historyOpen}
                    onToggleHistory={() =>
                      isMobile
                        ? setMobileSheet((v) => (v === "history" ? null : "history"))
                        : setHistoryOpen((v) => !v)
                    }
                    chatOpen={mobileSheet === "chat"}
                    onToggleChat={() => setMobileSheet((v) => (v === "chat" ? null : "chat"))}
                  />
                }
              />
            ) : (
              panel
            )}
            {!loading && !hydrationError && scope && !trialPanelOpen && (
              <div className="absolute top-4 right-4 z-20">
                <Tooltip label="View this conversation's trials">
                  <button onClick={openPanel} aria-label="Open conversation trials" className="flex items-center gap-2 h-10 px-4 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-600 dark:text-slate-300">
                    <PanelRight className="h-4 w-4" />
                    Trials {scope.trialIds.length}
                  </button>
                </Tooltip>
              </div>
            )}
            </div>
          );
        })()}

        {/*
         * Chat column. In "dual" it's a percentage-width docked column
         * (no longer shrinks to an icon rail when History opens — History
         * is an overlay in "dual", see below, so Chat always keeps its
         * normal width); in "chat-full" it takes the entire surface;
         * width animates to 0 (instead of unmounting) in "trial-full".
         * New Search / Search History controls only appear in its header
         * once Chat IS the main panel (chat-full) — while merely docked
         * in "dual", History is already reachable from the Trial Panel's
         * own header (shared `historyOpen` state), so repeating it here
         * would be redundant. The fullscreen toggle itself is always
         * rendered (even for bookmark-snapshot threads) but disabled when
         * `lockDual`, for the same header-consistency reason as the
         * Trial Panel's own (disabled) fullscreen button — see
         * BookmarkSnapshotPanel.
         */}
        <div
          className={`hidden md:flex md:flex-col overflow-hidden border-slate-200/70 dark:border-slate-700/60 transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            showChat ? "border-l" : ""
          } ${layoutMode === "dual" ? "md:shrink-0" : ""}`}
          style={{
            width: !showChat
              ? "0%"
              : layoutMode === "dual"
              ? `${CHAT_PANEL_WIDTH_PERCENT}%`
              : !isMobile && historyOpen
              ? "calc(100% - 16rem)"
              : "100%",
          }}
        >
              <div className="relative flex flex-1 min-h-0 flex-col">
                <div className={`flex items-center justify-between mb-2 shrink-0 pt-4 ${PANEL_PADDING_X}`}>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Chat
                  </span>
                  <div className="flex items-center gap-1">
                    {isChatFullscreen && (
                      <TrialPanelHeaderIcons
                        isMobile={false}
                        historyOpen={historyOpen}
                        onToggleHistory={() => setHistoryOpen((v) => !v)}
                      />
                    )}
                    <Tooltip label={lockDual ? "Fullscreen unavailable for bookmarked trials" : isChatFullscreen ? "Exit fullscreen" : "Fullscreen chat"}>
                      <button
                        onClick={lockDual ? undefined : () => setLayoutMode(isChatFullscreen ? "dual" : "chat-full")}
                        disabled={lockDual}
                        aria-label={isChatFullscreen ? "Exit fullscreen" : "Fullscreen chat"}
                        className={`p-1.5 rounded-lg ${lockDual ? "text-slate-300 dark:text-slate-600 cursor-not-allowed" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                      >
                        {isChatFullscreen ? <Minimize2 className="w-4 h-4" strokeWidth={2} /> : <Maximize2 className="w-4 h-4" strokeWidth={2} />}
                      </button>
                    </Tooltip>
                  </div>
                </div>
                {scope && <ThreadScopeHeader key={activeThreadKey} scope={scope} onViewTrials={openPanel} />}
                {loading ? <p role="status" className="m-auto text-sm text-slate-500">Loading conversation…</p> : hydrationError ? <div role="alert" className="m-auto p-6 text-sm text-red-600">{hydrationError}<button className="ml-2 underline" onClick={() => window.location.reload()}>Reload</button></div> : <ChatSurface
                  isScoped={!!scope}
                  placeholder={scope ? "Ask about these trials…" : PLACEHOLDER_INPUT}
                  greeting={scope ? (scope.trialIds.length === 1 ? "Discuss this trial" : `Discuss these ${scope.trialIds.length} trials`) : greeting}
                  prompts={scope ? [] : prompts}
                  intakeData={intakeData}
                />}
              </div>
        </div>

        {/* Search History as a scrim+overlay — "dual" already has two
         * panels sharing the row, so History floats above them instead of
         * squeezing either one (squeeze is reserved for the fullscreen
         * cases above, where there's only a single panel to share space
         * with). Always mounted (never conditionally rendered) while in
         * "dual" so open/close can transition smoothly — same convention
         * as the inline-squeeze History column and the Chat/Trial Panel
         * width transitions above — instead of popping in/out instantly.
         * Clicking the scrim (or anywhere outside the drawer, since the
         * scrim covers the rest of this row) closes it. */}
        {!isMobile && layoutMode === "dual" && (
          <div
            className={`absolute inset-0 z-30 flex transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              historyOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div
              className="w-64 h-full bg-white dark:bg-[#181D26] border-r border-slate-200/70 dark:border-slate-700/60 shadow-xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ transform: historyOpen ? "translateX(0)" : "translateX(-1rem)" }}
            >
              <SearchHistoryPanelContent onClose={() => setHistoryOpen(false)} />
            </div>
            <div className="flex-1 bg-black/20" onClick={() => setHistoryOpen(false)} />
          </div>
        )}
      </div>

        {/* Mobile: a single overlay sheet shared by Search History and
         * Chat (same mutex as desktop — only one can be the active value
         * of `mobileSheet`). */}
        {isMobile && mobileSheet && (
          <div className="absolute inset-0 z-30 flex justify-end">
            <div
              className="flex-1 bg-black/30"
              onClick={() => setMobileSheet(null)}
            />
            <div
              className="relative h-full bg-white dark:bg-[#181D26] border-l border-slate-200/70 dark:border-slate-700/60 flex flex-col"
              style={{ width: mobileSheet === "history" ? "min(80%, 20rem)" : CHAT_PANEL_MOBILE_WIDTH }}
            >
              {mobileSheet === "history" && (
                <>
                  <div className={`flex items-center justify-between mb-2 pt-4 shrink-0 ${PANEL_PADDING_X}`}>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Search History
                    </span>
                    <Tooltip label="Close search history">
                      <button
                        onClick={() => setMobileSheet(null)}
                        aria-label="Close search history"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-4 h-4" strokeWidth={2} />

                      </button>
                    </Tooltip>
                  </div>
                  <div
                    className={`flex-1 min-h-0 pb-4 ${PANEL_PADDING_X}`}
                    onClick={(e) => {
                      // Auto-close the sheet after picking/creating a thread.
                      if ((e.target as HTMLElement).closest("button")) {
                        setMobileSheet(null);
                      }
                    }}
                  >
                    <ThreadListSidebar />
                  </div>
                </>
              )}
              {mobileSheet === "chat" && (
                <div className="relative flex flex-1 min-h-0 flex-col">
                  <div className={`flex items-center justify-between mb-2 pt-4 shrink-0 ${PANEL_PADDING_X}`}>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Chat
                    </span>
                    <Tooltip label="Close chat">
                      <button
                        onClick={() => setMobileSheet(null)}
                        aria-label="Close chat"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </Tooltip>
                  </div>
                  {scope && <ThreadScopeHeader key={activeThreadKey} scope={scope} onViewTrials={openPanel} />}
                  {loading ? <p role="status" className="m-auto text-sm text-slate-500">Loading conversation…</p> : hydrationError ? <div role="alert" className="m-auto p-6 text-sm text-red-600">{hydrationError}</div> : <ChatSurface
                    isScoped={!!scope}
                    placeholder={scope ? "Ask about these trials…" : PLACEHOLDER_INPUT}
                    greeting={scope ? (scope.trialIds.length === 1 ? "Discuss this trial" : `Discuss these ${scope.trialIds.length} trials`) : greeting}
                    prompts={scope ? [] : prompts}
                    intakeData={intakeData}
                  />}
                </div>
              )}
            </div>
          </div>
        )}

        {!scope && showMatchModal && (
          <MatchProfileModal
            onConfirm={(_profile: MatchProfile, message: string) => {
              setShowMatchModal(false);
              openChatForRun();
              setAutoCloseChatPending(true);
              aui.thread.append(message);
            }}
            onClose={() => setShowMatchModal(false)}
          />
        )}

        {!scope && showClinicianModal && (
          <ClinicianModal
            initialStep="prescreen"
            onConfirm={(message: string) => {
              setShowClinicianModal(false);
              openChatForRun();
              setAutoCloseChatPending(true);
              aui.thread.append(message);
            }}
            onClose={() => setShowClinicianModal(false)}
          />
        )}

        {!loading && !hydrationError && !scope && <TrialSearchChatBridge />}
    </>
  );
}

/** Shared "Search History" header + list, used both as an inline column
 * (desktop "dual" layout) and inside a floating overlay (desktop
 * fullscreen layouts) — see AssistantPanelBody. */
function SearchHistoryPanelContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-64 h-full flex flex-col pt-4 pb-5">
      <div className={`flex items-center justify-between mb-2 shrink-0 ${PANEL_PADDING_X}`}>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Search History
        </span>
        <Tooltip label="Close search history">
          <button
            onClick={onClose}
            aria-label="Close search history"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <PanelRightClose className="w-4 h-4" strokeWidth={2} />
          </button>
        </Tooltip>
      </div>
      <div className={`flex-1 min-h-0 ${PANEL_PADDING_X}`}>
        <ThreadListSidebar />
      </div>
    </div>
  );
}

/**
 * Plain-icon (no circular button background) header row for the Trial
 * Panel: New Search (no open/close state, so no highlight) plus Search
 * History, and — mobile only — Open Chat (desktop never needs a chat
 * toggle here: Chat is either part of the default dual layout or reached
 * via its own fullscreen toggle).
 */
function TrialPanelHeaderIcons({
  isMobile,
  historyOpen,
  onToggleHistory,
  chatOpen,
  onToggleChat,
}: {
  isMobile: boolean;
  historyOpen: boolean;
  onToggleHistory: () => void;
  /** Mobile-only: opens/closes the Chat overlay sheet. Omitted on desktop,
   * where this icon row never renders a Chat toggle at all. */
  chatOpen?: boolean;
  onToggleChat?: () => void;
}) {
  const iconClass = (active: boolean) =>
    `p-1.5 rounded-lg transition-colors ${
      active
        ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip label="New search">
        <ThreadListPrimitive.New asChild>
          <button aria-label="New search" className={iconClass(false)}>
            <Plus className="w-4 h-4" strokeWidth={2} />
          </button>
        </ThreadListPrimitive.New>
      </Tooltip>
      <Tooltip label={historyOpen ? "Close search history" : "Search history"}>
        <button
          onClick={onToggleHistory}
          aria-label="Search history"
          aria-pressed={historyOpen}
          className={iconClass(historyOpen)}
        >
          <History className="w-4 h-4" strokeWidth={2} />
        </button>
      </Tooltip>
      {isMobile && (
        <Tooltip label={chatOpen ? "Close chat" : "Open chat"}>
          <button
            onClick={onToggleChat}
            aria-label="Open chat"
            aria-pressed={chatOpen}
            className={iconClass(!!chatOpen)}
          >
            <MessageSquareText className="w-4 h-4" strokeWidth={2} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

