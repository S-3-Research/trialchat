"use client";

import { ThreadListPrimitive, ThreadListItemPrimitive, useAuiState } from "@assistant-ui/react";
import { Plus, MessageSquare, Trash2 } from "lucide-react";

/**
 * "New Chat" + conversation history sidebar, built on assistant-ui's native
 * ThreadListPrimitive (no custom thread-fetching logic here — all the data
 * plumbing lives in lib/threadListAdapter.ts, wired in via
 * `unstable_threadListAdapter` on useLangGraphRuntime in AssistantPanel).
 */
export function ThreadListSidebar() {
  return (
    <ThreadListPrimitive.Root className="flex h-full w-full flex-col gap-2 overflow-hidden">
      <ThreadListPrimitive.New asChild>
        <button className="flex items-center gap-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2} />
          New Chat
        </button>
      </ThreadListPrimitive.New>

      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scrollbar flex flex-col gap-1 pr-1">
        <ThreadListPrimitive.Items
          components={{
            ThreadListItem: ThreadListItem,
          }}
        />
      </div>
    </ThreadListPrimitive.Root>
  );
}

function ThreadListItem() {
  // `custom` is whatever `createThreadListAdapter`'s list()/fetch() (see
  // lib/threadListAdapter.ts) attached to this thread's metadata —
  // `trialCount` is read straight off the thread's own LangGraph
  // checkpoint `values.activeTrialSearch`, no extra per-thread request.
  const trialCount = useAuiState((s) => s.threadListItem.custom?.trialCount) as
    | number
    | undefined;
  const title = useAuiState((s) => s.threadListItem.title);
  const id = useAuiState((s) => s.threadListItem.id);
  // The runtime uses switch generations so rapid clicks select the latest
  // target. Keep every row available while its trial state is loading.
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);
  const isActive = mainThreadId === id;

  return (
    <ThreadListItemPrimitive.Root
      className={`group flex items-stretch gap-0 rounded-xl text-sm transition-colors ${
        isActive
          ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
      } cursor-pointer`}
    >
      <ThreadListItemPrimitive.Trigger
        className="flex flex-1 items-center gap-2 min-w-0 text-left pl-3 pr-1 py-2.5"
      >
        <MessageSquare className="w-4 h-4 shrink-0 opacity-60" strokeWidth={2} />
        <span className="truncate" title={title || "New Chat"}>
          <ThreadListItemPrimitive.Title fallback="New Chat" />
        </span>
      </ThreadListItemPrimitive.Trigger>

      <div className="flex shrink-0 items-center gap-1 pr-3 py-2.5">
        {!!trialCount && (
          <span
            className="shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-blue-600 dark:text-blue-400 tabular-nums"
            title={`${trialCount} trial${trialCount === 1 ? "" : "s"} found`}
          >
            {trialCount}
          </span>
        )}

        <ThreadListItemPrimitive.Delete asChild>
          <button
            aria-label="Delete conversation"
            className="shrink-0 opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:pointer-events-none"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </ThreadListItemPrimitive.Delete>
      </div>
    </ThreadListItemPrimitive.Root>
  );
}
