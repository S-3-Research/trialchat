"use client";

import { Thread } from "@/components/assistant-ui/thread";
import type { IntakeData } from "@/lib/types/intake";
import type { ChatStarterPrompt } from "@/lib/types/prompts";

/**
 * Pure chat surface. The "Find matching trials" CTA (desktop pill +
 * mobile icon), Trial Panel trigger, and their Match/Clinician profile
 * modals now all live in AssistantPanel.tsx (AssistantPanelBody) — grouped
 * together in a shared floating-controls row so fixed-width buttons never
 * overlap the trigger regardless of how wide its "Trials N" label gets.
 */
export function ChatSurface({
  placeholder,
  greeting,
  prompts,
  isScoped = false,
}: {
  placeholder: string;
  greeting: string;
  prompts: ChatStarterPrompt[];
  intakeData: IntakeData | null;
  isScoped?: boolean;
}) {
  return (
    <div className="relative flex flex-1 w-full h-full min-h-0">
      <Thread placeholder={placeholder} greeting={greeting} prompts={prompts} isScoped={isScoped} />
    </div>
  );
}
