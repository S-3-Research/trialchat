"use client";
import { useState } from "react";
import type { ThreadContextScope } from "@/lib/bookmarks";
import { TrialCard } from "@/components/assistant-ui/TrialCard";
import { TrialPanelShell } from "@/components/assistant-ui/TrialPanelShell";

export type TrialSnapshot = Exclude<ThreadContextScope, { type: "trial_search" }>;

export function BookmarkSnapshotPanel({ scope, onClose }: { scope: TrialSnapshot; onClose: () => void }) {
  const trialsById = new Map(scope.trials.map((t) => [t.id, t]));
  const [focusedId, setFocusedId] = useState<string>();
  const date = new Date(scope.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return <TrialPanelShell title={scope.type === "bookmark_full_snapshot" ? "Bookmarked Trials" : "Selected Trials"} count={scope.trialIds.length} onClose={onClose} description={<div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
    <p>{scope.trialIds.length} {scope.trialIds.length === 1 ? "trial" : "trials"} in this conversation</p>
    <p>Snapshot from {date}</p>
    <p>These are the trials included when this conversation started.</p>
    <p>Trial details reflect what was saved at that time and are not refreshed.</p>
  </div>}>
    {scope.trialIds.map((id, index) => <div key={id}>
      {!trialsById.has(id) && <p role="status" className="mb-2 text-xs text-slate-500">No saved details for this trial.</p>}
      <TrialCard mode="bookmark-snapshot" trial={trialsById.get(id) ?? { id, title: id }} index={index} selected={focusedId === id} asked={false} locked={false} onToggleSelect={() => setFocusedId((current) => current === id ? undefined : id)} onAsked={() => undefined} onAsk={() => undefined} />
    </div>)}
  </TrialPanelShell>;
}
