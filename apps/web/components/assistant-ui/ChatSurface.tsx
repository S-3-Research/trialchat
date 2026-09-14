"use client";

import { useState } from "react";
import { useAui } from "@assistant-ui/react";
import { Zap } from "lucide-react";
import { Thread } from "@/components/assistant-ui/thread";
import { MatchProfileModal } from "@/components/MatchProfileModal";
import type { MatchProfile } from "@/components/MatchProfileModal";
import { ClinicianModal } from "@/components/ClinicianModal";
import type { IntakeData } from "@/lib/types/intake";
import type { ChatStarterPrompt } from "@/lib/types/prompts";

/**
 * Sits inside <AssistantRuntimeProvider>, so it can call useAui() to reach
 * the thread/composer clients. Wires up the pieces that live outside the
 * pure assistant-ui primitives: the Match/Clinician profile modals, which
 * send a message on confirm via aui.thread.append() (mirroring ChatKit's
 * chatkit.sendUserMessage). Voice input is handled natively by the composer
 * itself (ComposerPrimitive.Dictate, see thread.tsx) via the runtime's
 * DictationAdapter (see lib/voiceDictationAdapters.ts), so no custom voice
 * button wiring is needed here.
 */
export function ChatSurface({
  placeholder,
  greeting,
  prompts,
  intakeData,
}: {
  placeholder: string;
  greeting: string;
  prompts: ChatStarterPrompt[];
  intakeData: IntakeData | null;
}) {
  const aui = useAui();
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showClinicianModal, setShowClinicianModal] = useState(false);
  const isClinician = intakeData?.role === "clinician";

  return (
    <div className="relative flex flex-1 w-full h-full min-h-0">
      <Thread placeholder={placeholder} greeting={greeting} prompts={prompts} />

      {/* Top-center CTA — mirrors ChatKit's floating "Find matching trials" pill */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <button
          onClick={() => (isClinician ? setShowClinicianModal(true) : setShowMatchModal(true))}
          className="flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/40 shadow-[0_8px_24px_-6px_rgba(37,99,235,0.35)] hover:shadow-[0_10px_28px_-6px_rgba(37,99,235,0.45)] transition-shadow focus:outline-none select-none"
          aria-label={isClinician ? "Screen a patient for clinical trials" : "Find matching clinical trials"}
        >
          <Zap className="w-4 h-4 text-blue-600" strokeWidth={2} />
          <span className="font-semibold text-sm text-blue-600">
            {isClinician ? "Screen a patient" : "Find matching trials"}
          </span>
        </button>
      </div>

      {showMatchModal && (
        <MatchProfileModal
          onConfirm={(_profile: MatchProfile, message: string) => {
            setShowMatchModal(false);
            aui.thread.append(message);
          }}
          onClose={() => setShowMatchModal(false)}
        />
      )}

      {showClinicianModal && (
        <ClinicianModal
          initialStep="prescreen"
          onConfirm={(message: string) => {
            setShowClinicianModal(false);
            aui.thread.append(message);
          }}
          onClose={() => setShowClinicianModal(false)}
        />
      )}
    </div>
  );
}
