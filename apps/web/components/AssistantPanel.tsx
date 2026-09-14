"use client";

import { useEffect, useMemo, useState } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  unstable_createLangGraphStream,
  useLangGraphRuntime,
  type LangChainMessage,
} from "@assistant-ui/react-langgraph";
import { createAgentClient, AGENT_ASSISTANT_ID } from "@/lib/agentClient";
import { ChatSurface } from "@/components/assistant-ui/ChatSurface";
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
 * Phase B: LangGraph-backed chat panel with starter prompts / greeting
 * parity with the ChatKit experience.
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

  const runtime = useLangGraphRuntime({
    unstable_allowCancellation: true,
    stream,
    adapters: { dictation },
    create: async () => {
      const { thread_id } = await client.threads.create();
      return { externalId: thread_id };
    },
    load: async (externalId) => {
      const state = await client.threads.getState<{
        messages: LangChainMessage[];
      }>(externalId);
      return {
        messages: state.values.messages ?? [],
        interrupts: state.tasks[0]?.interrupts,
      };
    },
  });

  return (
    <div className="relative flex flex-1 w-full h-full rounded-[32px] flex-col overflow-hidden border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-[#181D26] shadow-[0_30px_80px_-20px_rgba(30,41,59,0.18)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] transition-colors">
      <AssistantRuntimeProvider runtime={runtime}>
        <ChatSurface
          placeholder={PLACEHOLDER_INPUT}
          greeting={greeting}
          prompts={prompts}
          intakeData={intakeData}
        />
      </AssistantRuntimeProvider>
    </div>
  );
}

