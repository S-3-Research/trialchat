"use client";

import { AssistantPanel } from "@/components/AssistantPanel";

export default function ChatPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 pt-2 md:p-6 md:pt-4">
      <AssistantPanel />
    </div>
  );
}
