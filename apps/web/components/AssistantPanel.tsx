"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AssistantRuntimeProvider, ThreadListPrimitive, useAuiState } from "@assistant-ui/react";
import {
  unstable_createLangGraphStream,
  useLangGraphRuntime,
  type LangChainMessage,
  type UIMessage,
} from "@assistant-ui/react-langgraph";
import { PanelLeft, PanelLeftClose, Plus, X } from "lucide-react";
import { createAgentClient, AGENT_ASSISTANT_ID } from "@/lib/agentClient";
import { debugAgentStream } from "@/lib/debugAgentStream";
import { createThreadListAdapter } from "@/lib/threadListAdapter";
import { getOrCreateGuestUserId } from "@/lib/guestId";
import { ChatSurface } from "@/components/assistant-ui/ChatSurface";
import { ThreadListSidebar } from "@/components/assistant-ui/ThreadListSidebar";
import { SuggestionsWidget } from "@/components/assistant-ui/tool-ui";
import { TrialSearchChatBridge } from "@/components/assistant-ui/TrialSearchChatBridge";
import {
  TrialPanel,
  TrialPanelTrigger,
  TRIAL_PANEL_WIDTH_PERCENT,
  TRIAL_PANEL_MOBILE_WIDTH,
} from "@/components/assistant-ui/TrialPanel";
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
import { useLayoutTier } from "@/hooks/useLayoutTier";
import { INTAKE_STORAGE_KEY, type IntakeData } from "@/lib/types/intake";
import { useVoiceInputMode } from "@/contexts/VoiceInputModeContext";
import {
  createWebSpeechDictationAdapter,
  WhisperDictationAdapter,
} from "@/lib/voiceDictationAdapters";

/**
 * Phase B/D: LangGraph-backed chat panel with starter prompts / greeting
 * parity with the ChatKit experience, plus a New Chat / history sidebar
 * (Phase D) backed by LangGraph Server's own thread storage — see
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
  // Sidebar defaults to collapsed on both desktop and mobile — a slide-out
  // panel toggled via the PanelLeft trigger (see the floating top-left
  // controls below) rather than a permanently-docked column, so the chat
  // surface gets the full panel width by default.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Stable runtime slot identity owns the Panel state; the remote id only
  // selects its persistence endpoint. Assigning a new chat its remote id
  // must not discard edits made before its first message.
  const [activeThread, setActiveThread] = useState<{
    key?: string;
    remoteId?: string;
    trialState?: TrialSearchState;
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
    if (!activeRemoteId) return undefined;
    return {
      save: async (payload: PersistedTrialSearch, { signal }) => {
        await client.threads.updateState(activeRemoteId, {
          values: { activeTrialSearch: payload },
          signal,
        });
      },
    };
  }, [client, activeRemoteId]);

  useEffect(() => {
    const stored = window.localStorage.getItem(INTAKE_STORAGE_KEY);
    if (!stored) return;
    try {
      setIntakeData(JSON.parse(stored));
    } catch (error) {
      console.error("[AssistantPanel] Failed to parse intake data:", error);
    }
  }, []);

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
      debugAgentStream(unstable_createLangGraphStream({
        client,
        assistantId: AGENT_ASSISTANT_ID,
        // Use the native message tuple stream so streamed chunks and the
        // final reply share a stable ID with the attached suggestions UI.
        streamMode: ["messages-tuple", "updates", "custom"],
      })),
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
        <TrialThreadSync
          client={client}
          onThreadSwitch={(key, remoteId, trialState) => {
            // TrialThreadSync follows the runtime's actual selection, including
            // New Chat, deletion and programmatic navigation. Its fetch generation
            // guard discards responses belonging to a previous selection.
            setActiveThread({ key, remoteId, trialState });
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
              isMobile={isMobile}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
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
    trialState: TrialSearchState | undefined
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
      .getState<{ activeTrialSearch?: PersistedTrialSearch }>(currentRemoteId)
      .then((state) => {
        if (cancelled || seq !== seqRef.current) return;
        const trialState = fromPersistedTrialSearch(state.values.activeTrialSearch);
        onHydratingChangeRef.current(false);
        onThreadSwitchRef.current(id, currentRemoteId, trialState);
      })
      .catch((error) => {
        if (cancelled || seq !== seqRef.current) return;
        console.error("[TrialThreadSync] Failed to load trial state for thread:", error);
        onHydratingChangeRef.current(false);
        // Still switch the Provider to this thread (empty/idle state) so the
        // Panel doesn't keep showing a stale, different thread's search.
        onThreadSwitchRef.current(id, currentRemoteId, undefined);
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
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  greeting,
  prompts,
  intakeData,
}: {
  isMobile: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  greeting: string;
  prompts: ReturnType<typeof toChatStarterPrompts>;
  intakeData: IntakeData | null;
}) {
  const { panelOpen: trialPanelOpen, closePanel: closeTrialPanel } = useTrialSearch();

  // At medium widths keep the newly opened panel. On a resize from the
  // three-column layout, prefer the Trial Panel rather than closing both.
  const layoutTier = useLayoutTier();
  const previousPanels = useRef({ sidebarOpen, trialPanelOpen });
  useEffect(() => {
    const sidebarJustOpened = sidebarOpen && !previousPanels.current.sidebarOpen;
    previousPanels.current = { sidebarOpen, trialPanelOpen };
    if (layoutTier !== "compact" || !sidebarOpen || !trialPanelOpen) return;
    if (sidebarJustOpened) closeTrialPanel();
    else setSidebarOpen(false);
  }, [layoutTier, sidebarOpen, trialPanelOpen, closeTrialPanel, setSidebarOpen]);

  return (
    <>
      {/*
         * Desktop: collapsible sidebar (default closed) that slides in/out
         * by animating its own width, rather than being permanently
         * docked — the inner column keeps a fixed w-64 so its content
         * doesn't reflow/wrap mid-transition, only the outer wrapper's
         * width (and thus how much of it is visible) animates.
         */}
        <div
          className={`hidden md:flex md:shrink-0 flex-col overflow-hidden border-slate-200/70 dark:border-slate-700/60 transition-[width] duration-300 ease-in-out ${
            sidebarOpen ? "md:w-64 border-r" : "md:w-0 border-r-0"
          }`}
        >
          <div className="w-64 h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Chats
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Collapse chat history"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <PanelLeftClose className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ThreadListSidebar />
            </div>
          </div>
        </div>

        {/* Mobile: drawer toggled by the shared floating trigger below */}
        {isMobile && sidebarOpen && (
          <div className="absolute inset-0 z-30 flex">
            <div className="w-72 max-w-[80%] h-full bg-white dark:bg-[#181D26] p-4 flex flex-col border-r border-slate-200/70 dark:border-slate-700/60">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Chats
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close chat history"
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
              <div
                className="flex-1 min-h-0"
                onClick={(e) => {
                  // Auto-close the drawer after picking/creating a thread.
                  if ((e.target as HTMLElement).closest("button")) {
                    setSidebarOpen(false);
                  }
                }}
              >
                <ThreadListSidebar />
              </div>
            </div>
            <div
              className="flex-1 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
          </div>
        )}

        <div className="relative flex flex-1 min-w-0 flex-col">
          {/*
           * Shared floating controls — expand-sidebar + new-chat — shown
           * whenever the sidebar is collapsed, on both desktop and mobile
           * (previously this was mobile-only, leaving desktop users no way
           * to reopen a fully-collapsed sidebar).
           */}
          {!sidebarOpen && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open chat history"
                className="flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <PanelLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <ThreadListPrimitive.New asChild>
                <button
                  aria-label="New chat"
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                </button>
              </ThreadListPrimitive.New>
            </div>
          )}
          <ChatSurface
            placeholder={PLACEHOLDER_INPUT}
            greeting={greeting}
            prompts={prompts}
            intakeData={intakeData}
          />
          <TrialPanelTrigger />
        </div>

        {/*
         * Right-side Trial Panel — persistent structured view of the
         * active trial search (see contexts/TrialSearchContext.tsx). On
         * desktop it docks alongside chat, animating width like the left
         * sidebar; on mobile it becomes a full-height sheet so chat never
         * has to share horizontal space with it.
         */}
        <div
          className={`hidden md:flex md:shrink-0 flex-col overflow-hidden border-slate-200/70 dark:border-slate-700/60 transition-[width] duration-300 ease-in-out ${
            trialPanelOpen ? "border-l" : "border-l-0"
          }`}
          style={{ width: trialPanelOpen ? `${TRIAL_PANEL_WIDTH_PERCENT}%` : 0 }}
        >
          <TrialPanel />
        </div>

        {isMobile && trialPanelOpen && (
          <div className="absolute inset-0 z-30 flex justify-end">
            <div className="flex-1 bg-black/30" onClick={closeTrialPanel} />
            <div
              className="h-full bg-white dark:bg-[#181D26] border-l border-slate-200/70 dark:border-slate-700/60"
              style={{ width: TRIAL_PANEL_MOBILE_WIDTH }}
            >
              <TrialPanel />
            </div>
          </div>
        )}

        <TrialSearchChatBridge />
    </>
  );
}
