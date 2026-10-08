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
 * Shared visual shell for the two independent cards that make up the
 * desktop "dual" layout — Trial Panel and Chat. Previously this styling
 * (rounded corners, border, background, shadow) lived on a single outer
 * wrapper around both columns (see the bottom of AssistantPanelBody's
 * render); now each column owns it directly so they read as two distinct
 * cards with a gap between them, rather than one card split by a border.
 * Mobile keeps a slightly larger radius (only ever one card visible
 * there) to match the old single-card look.
 */
const PANEL_CARD_CLASS =
  "rounded-[32px] md:rounded-[28px] overflow-hidden border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-[#181D26] shadow-[0_30px_70px_-24px_rgba(30,41,59,0.25)] dark:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.6)]";

/**
 * === Apple-carousel-style dual/fullscreen transition — TUNING KNOBS ===
 * Switching between "dual" and either fullscreen mode no longer animates
 * width down to 0 on the disappearing card (that caused its box-shadow to
 * bunch up into a solid vertical bar as the card got squeezed — see the
 * card-splitting change above). Instead the disappearing card slides
 * fully out of the row via `transform: translateX()` + fades via
 * `opacity`, while the *other* (remaining/growing) card's `width`
 * transition kicks in slightly after — that stagger is what reads as a
 * deliberate, Apple-carousel-like overlap instead of two edges moving in
 * perfect, slightly robotic lockstep. See the Trial/Chat card blocks
 * below (search for PANEL_EXPAND_DELAY_MS) for where these are applied.
 *
 * - PANEL_TRANSITION_MS: duration of both the slide/fade and the width
 *   animation. Keep the two equal so they finish together despite the
 *   stagger below.
 * - PANEL_TRANSITION_EASE: shared easing curve for both.
 * - PANEL_EXPAND_DELAY_MS: how long the growing/shrinking card's WIDTH
 *   transition waits before starting, relative to the other card's
 *   slide/fade (which always starts at 0 delay). Bigger = more
 *   pronounced "the other card is already moving before this one
 *   reacts" overlap; 0 = both move in lockstep (no carousel feel); too
 *   large (beyond ~half of PANEL_TRANSITION_MS) starts to look like two
 *   separate, disconnected animations rather than one choreographed move.
 */
const PANEL_TRANSITION_MS = 620;
const PANEL_TRANSITION_EASE = "cubic-bezier(0.32,0.72,0,1)";
const PANEL_EXPAND_DELAY_MS = 120;


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
    <div className="relative flex flex-1 w-full h-full mx-auto max-w-7xl transition-colors">
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

  // Tracks the layoutMode from just before the current one, read DURING
  // render (the ref update in the effect below only lands after this
  // render commits) so the choreography math right after a layoutMode
  // change can still see "where we came from". Used to decide, per card,
  // whether IT is the one sliding off/onto screen for the transition
  // currently in flight — see trialSlidesThisTransition/
  // chatSlidesThisTransition below, and the width-transition-delay
  // comment where they're consumed. Without this, a card that's
  // sliding in while *also* needing to change width (e.g. Chat
  // reappearing from "trial-full" back into "dual", where it both
  // slides in AND shrinks from 100% back to its docked width) would
  // have its width change arrive on the same staggered delay as the
  // *other*, merely-resizing card — making the sliding-in card visibly
  // arrive at its old (wrong) width first, then resize afterwards
  // ("widens then narrows"). Synchronizing its width change with its
  // own slide (zero delay) instead fixes that.
  const prevLayoutModeRef = useRef(layoutMode);
  useEffect(() => {
    prevLayoutModeRef.current = layoutMode;
  }, [layoutMode]);
  const prevLayoutMode = prevLayoutModeRef.current;
  // Each card's width/transform/opacity transitions all share a single
  // per-transition delay, chosen so that whichever card is RECEDING
  // (sliding away to hide, or shrinking while staying visible) always
  // moves first at 0 delay, while whichever card is ARRIVING (sliding in
  // to reveal, or expanding while staying visible) waits
  // PANEL_EXPAND_DELAY_MS so it only starts once the receding card has
  // had a head start — "make room, then fill it", in BOTH directions.
  //
  // This used to be judged purely by "is this card the one that slides
  // for this transition" (always 0 delay) vs. "merely resizes" (always
  // delayed) — which happened to work for ENTERING a fullscreen mode
  // (dual → trial-full: Chat recedes/slides at 0, Trial arrives/expands
  // delayed — correct) but was backwards for RETURNING to dual
  // (trial-full → dual: Trial should recede/shrink FIRST at 0 delay so
  // Chat has room, then Chat arrives/slides in delayed — the old logic
  // instead gave Chat's slide-in 0 delay and Trial's shrink the delay,
  // so Chat visibly started arriving before Trial had even begun
  // shrinking). The booleans below instead key off which specific
  // fullscreen axis (trial-full vs. chat-full) is being entered/left,
  // independent of which card happens to be doing the sliding vs. the
  // resizing.
  const goingToTrialFull = layoutMode === "trial-full";
  const leavingTrialFull = prevLayoutMode === "trial-full"; // implies layoutMode is now "dual"
  const goingToChatFull = layoutMode === "chat-full";
  const leavingChatFull = prevLayoutMode === "chat-full"; // implies layoutMode is now "dual"
  // Trial Panel hides/shows (slides) on the chat-full axis, and
  // expands/shrinks (resizes, staying visible) on the trial-full axis.
  const trialDelay = goingToChatFull
    ? 0 // Trial is receding (hiding) — move first
    : leavingChatFull
    ? PANEL_EXPAND_DELAY_MS // Trial is arriving (showing) — wait for Chat to shrink first
    : goingToTrialFull
    ? PANEL_EXPAND_DELAY_MS // Trial is arriving (expanding) — wait for Chat to recede first
    : leavingTrialFull
    ? 0 // Trial is receding (shrinking) — move first
    : PANEL_EXPAND_DELAY_MS; // steady state; never visually observed
  // Chat is the mirror image: hides/shows (slides) on the trial-full
  // axis, expands/shrinks (resizes, staying visible) on the chat-full axis.
  const chatDelay = goingToTrialFull
    ? 0 // Chat is receding (hiding) — move first
    : leavingTrialFull
    ? PANEL_EXPAND_DELAY_MS // Chat is arriving (showing) — wait for Trial to shrink first
    : goingToChatFull
    ? PANEL_EXPAND_DELAY_MS // Chat is arriving (expanding) — wait for Trial to recede first
    : leavingChatFull
    ? 0 // Chat is receding (shrinking) — move first
    : PANEL_EXPAND_DELAY_MS; // steady state; never visually observed

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
      <div className="relative flex-1 min-w-0 h-full">
        {(() => {
          // Trial Panel card. Positioned absolutely (rather than a flex
          // child) so its width and its visibility-driven slide/fade can
          // animate independently of the Chat card — see the
          // PANEL_TRANSITION_* constants above for the choreography.
          // Mobile always gets the full width/left:0 — Chat is an
          // overlay sheet there (further below), never an inline
          // sibling, so there's nothing to share space or stagger with.
          const trialHidden = !isMobile && !showTrial; // only in "chat-full"
          const trialWidthPercent = isMobile || layoutMode !== "dual" ? 100 : 100 - CHAT_PANEL_WIDTH_PERCENT;
          const trialWidth = isMobile
            ? "100%"
            : layoutMode === "dual"
            ? `calc(${trialWidthPercent}% - 0.5rem)`
            : "100%";
          // Search History still squeezes in from the LEFT of the Trial
          // Panel card specifically when this card is the sole fullscreen
          // surface ("trial-full") — it lives inside this card's own flex
          // row (rather than a row-level column), so the card's own width
          // stays a clean percentage; the squeeze is purely an internal
          // flex split and never affects the outer row's positioning.
          const historySqueeze = !isMobile && historyOpen && layoutMode === "trial-full";
          return (
            // Outer slide layer: always spans the row's FULL width (not
            // the card's own, narrower target width), so its
            // `translateX(±100%)` is resolved against that same full
            // width — i.e. exactly the row's own edge-to-edge span —
            // which is what makes the card visibly keep sliding for the
            // ENTIRE transition duration instead of disappearing early
            // (see the ancestor page's own overflow-hidden, several
            // levels up, for where the slide actually gets clipped —
            // intentionally NOT this row, so the card travels all the
            // way to the real viewport/page edge instead of stopping at
            // this row's own narrow bounds).
            //
            // This outer wrapper is ALWAYS `pointer-events: none` — even
            // while fully visible — because it spans the row's full
            // width (so its translateX basis lines up with the slide
            // distance), which is wider than the actual visible card
            // sitting inside it. Without this, the empty portion of its
            // bounding box (the part NOT covered by the inner card, e.g.
            // the space to the right of a narrower Trial card in "dual")
            // would silently swallow clicks meant for whatever sits
            // beneath/beside it — which is exactly what broke the Trial
            // Panel's own fullscreen button: Chat's full-width outer
            // wrapper (z-10, rendered after Trial in DOM order) was
            // pointer-events:auto across the ENTIRE row whenever Chat
            // was visible (i.e. in "dual"), including over the Trial
            // card's left-hand header where that button lives. Real
            // hit-testing is delegated entirely to the inner card below,
            // which is sized to its own actual visible bounds.
            <div
              className="absolute inset-y-0 left-0 w-full pointer-events-none"
              aria-hidden={trialHidden}
              style={{
                zIndex: 0,
                transform: trialHidden ? "translateX(-100%)" : "translateX(0)",
                opacity: trialHidden ? 0 : 1,
                transition: [
                  `transform ${PANEL_TRANSITION_MS}ms ${PANEL_TRANSITION_EASE} ${trialDelay}ms`,
                  `opacity ${PANEL_TRANSITION_MS}ms ${PANEL_TRANSITION_EASE} ${trialDelay}ms`,
                ].join(", "),
              }}
            >
              <div
                className={`${PANEL_CARD_CLASS} absolute inset-y-0 left-0 flex flex-col`}
                style={{
                  width: trialWidth,
                  pointerEvents: trialHidden ? "none" : "auto",
                  transition: `width ${PANEL_TRANSITION_MS}ms ${PANEL_TRANSITION_EASE} ${trialDelay}ms`,
                }}
              >
              <div className="relative flex flex-1 min-h-0">
                <div
                  className={`hidden md:flex md:flex-col shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    historySqueeze ? "border-r border-slate-200/70 dark:border-slate-700/60" : ""
                  }`}
                  style={{ width: historySqueeze ? "16rem" : "0" }}
                >
                  <SearchHistoryPanelContent onClose={() => setHistoryOpen(false)} />
                </div>
                <div className="relative flex-1 min-w-0 flex flex-col">
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
              </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          // Chat card. Mirrors the Trial card above (absolute, independent
          // width + slide/fade animation). Always mounted regardless of
          // layoutMode — even while fully slid-out and faded in
          // "trial-full" — so ChatSurface's internal state (scroll
          // position, in-flight stream, composer draft) never resets;
          // only its visibility is toggled via transform/opacity/
          // pointer-events, never via unmounting.
          // New Search / Search History controls only appear in its header
          // once Chat IS the main panel (chat-full) — while merely docked
          // in "dual", History is already reachable from the Trial Panel's
          // own header (shared `historyOpen` state), so repeating it here
          // would be redundant. The fullscreen toggle itself is always
          // rendered (even for bookmark-snapshot threads) but disabled when
          // `lockDual`, for the same header-consistency reason as the
          // Trial Panel's own (disabled) fullscreen button — see
          // BookmarkSnapshotPanel.
          const chatHidden = isMobile || !showChat; // mobile: always the sheet below, never this inline card
          const chatWidthPercent = layoutMode !== "dual" ? 100 : CHAT_PANEL_WIDTH_PERCENT;
          const chatWidth = layoutMode === "dual" ? `calc(${chatWidthPercent}% - 0.5rem)` : "100%";
          // Search History squeezes in from the left of the Chat card
          // specifically when Chat is the sole fullscreen surface
          // ("chat-full") — same internal-flex-row approach as the Trial
          // Panel card above, instead of a row-level column.
          const historySqueeze = !isMobile && historyOpen && layoutMode === "chat-full";
          return (
            // Mirrors the Trial card's outer-slide-layer/inner-anchored-
            // card split above (full-width outer layer for a correct
            // slide distance, always pointer-events:none; the inner,
            // actually-visible card owns real pointer-events and width) —
            // see that comment for the full rationale, including why
            // this fixes a real click-blocking bug when this card used
            // to be pointer-events:auto across its own full-width
            // wrapper.
            <div
              className="hidden md:absolute md:inset-y-0 md:right-0 md:w-full md:flex md:flex-col pointer-events-none"
              aria-hidden={chatHidden}
              style={{
                zIndex: 10,
                transform: chatHidden ? "translateX(100%)" : "translateX(0)",
                opacity: chatHidden ? 0 : 1,
                transition: [
                  `transform ${PANEL_TRANSITION_MS}ms ${PANEL_TRANSITION_EASE} ${chatDelay}ms`,
                  `opacity ${PANEL_TRANSITION_MS}ms ${PANEL_TRANSITION_EASE} ${chatDelay}ms`,
                ].join(", "),
              }}
            >
              <div
                className={`${PANEL_CARD_CLASS} absolute inset-y-0 right-0 flex flex-col`}
                style={{
                  width: chatWidth,
                  pointerEvents: chatHidden ? "none" : "auto",
                  transition: `width ${PANEL_TRANSITION_MS}ms ${PANEL_TRANSITION_EASE} ${chatDelay}ms`,
                }}
              >
              <div className="relative flex flex-1 min-h-0">
                <div
                  className={`hidden md:flex md:flex-col shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    historySqueeze ? "border-r border-slate-200/70 dark:border-slate-700/60" : ""
                  }`}
                  style={{ width: historySqueeze ? "16rem" : "0" }}
                >
                  <SearchHistoryPanelContent onClose={() => setHistoryOpen(false)} />
                </div>
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
              </div>
            </div>
          );
        })()}

        {/* Search History as a scrim+overlay — "dual" already has two
         * cards sharing the row, so History floats above them, anchored
         * to the left edge of the Trial Panel card, instead of squeezing
         * either one (squeeze is reserved for the fullscreen cases above,
         * where there's only a single card to share space with). Always
         * mounted (never conditionally rendered) while in "dual" so
         * open/close can transition smoothly — same convention as the
         * inline-squeeze History column and the Chat/Trial Panel width
         * transitions above — instead of popping in/out instantly.
         * Clicking the scrim (or anywhere outside the drawer, since the
         * scrim covers the rest of this row) closes it. */}
        {!isMobile && layoutMode === "dual" && (
          <div
            className={`absolute inset-0 z-30 flex rounded-[32px] md:rounded-[28px] overflow-hidden transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
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

