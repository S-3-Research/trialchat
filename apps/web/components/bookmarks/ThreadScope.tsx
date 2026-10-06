"use client";
import { useEffect, useRef, useState } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { createAgentClient } from "@/lib/agentClient";
import { getOrCreateGuestUserId } from "@/lib/guestId";
import type { TrialSnapshot } from "./BookmarkSnapshotPanel";
import { createScopedThread } from "@/lib/createScopedThread";
import Link from "next/link";
import { useBookmarks } from "@/hooks/useBookmarks";


/** Open an already-created normal thread; never create a singleton bookmark chat. */
export function ThreadNavigation({ enabled = true }: { enabled?: boolean }) {
  const aui = useAui();
  const remoteId = useAuiState((state) => state.optional.threadListItem?.remoteId);
  const started = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    const params = new URL(window.location.href).searchParams;
    const id = params.get("thread");
    void (async () => {
      try {
        if (params.get("new") === "1") {
          await aui.threads.switchToNewThread();
        } else if (id) {
          const thread = await createAgentClient().threads.get(id);
          if (thread.metadata?.userId !== getOrCreateGuestUserId()) throw new Error("Thread does not belong to this visitor.");
          await aui.threads.switchToThread(id);
          if (typeof thread.metadata?.initialPrompt === "string" && !aui.thread.getState().messages.length) {
            aui.composer.setText(thread.metadata.initialPrompt);
          }
        }
        // The clinician homepage flow hands a pre-screen request to the chat.
        // Consume it once, after selecting the requested/new conversation.
        const prescreen = sessionStorage.getItem("clinician_prescreen_prompt");
        if (prescreen && !id) {
          sessionStorage.removeItem("clinician_prescreen_prompt");
          aui.thread.append(prescreen);
        }
        setReady(true);
      } catch { setError("Could not open this conversation. Reload to retry."); }
    })();
  }, [aui, enabled]);
  useEffect(() => {
    if (!ready) return;
    // Keep the selected thread addressable: a reload must restore its fixed set.
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    if (remoteId) url.searchParams.set("thread", remoteId);
    else url.searchParams.delete("thread");
    window.history.replaceState(null, "", url);
  }, [ready, remoteId]);
  return error ? <p role="alert" className="p-3 text-red-600">{error}</p> : null;
}

/** Live collection differences are informational; this component never writes scope.
 * Rendered directly below the Chat column's "Chat" header row (desktop and
 * mobile), so it no longer needs a large top offset to clear floating
 * controls — a small fixed margin matching the header's own padding is
 * enough. */
export function ThreadScopeHeader({ scope, onViewTrials }: { scope: TrialSnapshot; onViewTrials: () => void }) {
  const { bookmarks, ready } = useBookmarks();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const currentIds = bookmarks.map((b) => b.trialId);
  const changed = ready && scope.type === "bookmark_full_snapshot" &&
    (currentIds.length !== scope.trialIds.length || currentIds.some((id) => !scope.trialIds.includes(id)));
  const startNew = async () => {
    if (busy || !currentIds.length) return;
    setBusy(true); setError(undefined);
    try {
      const trials = bookmarks.map((b) => b.trial).filter((t) => !!t);
      const id = await createScopedThread("bookmark_full_snapshot", currentIds, `Discuss ${currentIds.length} bookmarked ${currentIds.length === 1 ? "trial" : "trials"}`, trials);
      // Navigate to a fresh runtime, preserving the old thread and its messages.
      window.location.assign(`/chat?thread=${encodeURIComponent(id)}`);
    } catch { setBusy(false); setError("Could not create the conversation. Please try again."); }
  };
  return <div className="shrink-0 mx-4 mb-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
    <div className="flex flex-wrap items-center gap-3"><strong>Discussing {scope.trialIds.length} {scope.trialIds.length === 1 ? "trial" : "trials"}</strong></div>
    {changed && <div className="mt-2 space-y-1">
      <p>Your bookmarks have changed since this conversation started.</p>
      <p>This conversation is still using the original {scope.trialIds.length} {scope.trialIds.length === 1 ? "trial" : "trials"}.</p>
      {currentIds.length ? <button onClick={startNew} disabled={busy} className="text-blue-600 dark:text-blue-400 disabled:opacity-40">{busy ? "Creating conversation…" : "Start a new chat with current bookmarks"}</button> : <p>There are no current bookmarks. <Link href="/bookmarks" className="text-blue-600 dark:text-blue-400">Go to Bookmarks →</Link></p>}
    </div>}
    <div className="mt-2 flex flex-wrap gap-4 text-xs text-blue-600 dark:text-blue-400">
      <Link href="/bookmarks">Manage bookmarks →</Link>
      <a href="/chat?new=1">Search for more trials →</a>
    </div>
    {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
  </div>;
}
