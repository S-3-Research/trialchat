"use client";

import { AssistantPanel } from "@/components/AssistantPanel";

/**
 * Phase A validation route for the LangGraph + assistant-ui migration.
 * Does not touch the existing ChatKit-based /trial-chat/chat page.
 */
export default function ChatV2Page() {
  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6">
      <AssistantPanel />
    </div>
  );
}
