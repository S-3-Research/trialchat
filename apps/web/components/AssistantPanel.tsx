"use client";

import { useEffect, useMemo, useState } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  unstable_createLangGraphStream,
  useLangGraphRuntime,
  type LangChainMessage,
  type UIMessage,
} from "@assistant-ui/react-langgraph";
import { PanelLeft, X } from "lucide-react";
import { createAgentClient, AGENT_ASSISTANT_ID } from "@/lib/agentClient";
import { createThreadListAdapter } from "@/lib/threadListAdapter";
import { getOrCreateGuestUserId } from "@/lib/guestId";
import { ChatSurface } from "@/components/assistant-ui/ChatSurface";
import { ThreadListSidebar } from "@/components/assistant-ui/ThreadListSidebar";
import { SuggestionsWidget } from "@/components/assistant-ui/tool-ui";
import {
  PLACEHOLDER_INPUT,
  getGreetingForUser,
  getStarterPromptsForUser,
} from "@/lib/config";
import { toChatStarterPrompts } from "@/lib/types/prompts";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      unstable_createLangGraphStream({
        client,
        assistantId: AGENT_ASSISTANT_ID,
      }),
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
    <div className="relative flex flex-1 w-full h-full rounded-[32px] overflow-hidden border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-[#181D26] shadow-[0_30px_80px_-20px_rgba(30,41,59,0.18)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] transition-colors">
      <AssistantRuntimeProvider runtime={runtime}>
        {/* Desktop: persistent sidebar */}
        <div className="hidden md:flex md:w-64 md:shrink-0 flex-col border-r border-slate-200/70 dark:border-slate-700/60 p-3">
          <ThreadListSidebar />
        </div>

        {/* Mobile: drawer toggled by the panel-left button below */}
        {isMobile && sidebarOpen && (
          <div className="absolute inset-0 z-30 flex">
            <div className="w-72 max-w-[80%] h-full bg-white dark:bg-[#181D26] p-3 flex flex-col border-r border-slate-200/70 dark:border-slate-700/60">
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
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open chat history"
              className="absolute top-4 left-4 z-20 flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 shadow-sm text-slate-600 dark:text-slate-300"
            >
              <PanelLeft className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
          <ChatSurface
            placeholder={PLACEHOLDER_INPUT}
            greeting={greeting}
            prompts={prompts}
            intakeData={intakeData}
          />
        </div>
      </AssistantRuntimeProvider>
    </div>
  );
}

