"use client";
import { Bookmark } from "lucide-react";
import { useBookmarks } from "@/hooks/useBookmarks";
import { toTrialSnapshot } from "@/lib/bookmarks";
import type { Trial } from "@/lib/types/trialSearch";

/** `compact` renders a bare inline icon button (no padding/background), meant to be
 * embedded inside another pill/badge (e.g. the card's #NN index pill) rather than
 * standing alone. `trial` is captured into the bookmark as-is — it's the only copy
 * of this trial's data any frozen conversation built from it will ever see. */
export function BookmarkButton({ trial, sourceThreadId, sourceSearchId, compact }: { trial: Trial; sourceThreadId?: string; sourceSearchId?: string; compact?: boolean }) {
  const { ready, error, isTrialBookmarked, setBookmarked } = useBookmarks();
  const trialId = trial.id!;
  const active = isTrialBookmarked(trialId);
  const button = <button type="button" disabled={!ready} aria-pressed={active} aria-label={`${active ? "Remove bookmark for" : "Bookmark"} ${trialId}`} title={active ? "Remove bookmark" : "Bookmark trial"}
      className={compact
        ? `rounded-full p-0.5 transition-all duration-150 hover:scale-110 active:scale-90 disabled:opacity-40 disabled:hover:scale-100 ${
            active
              ? "text-blue-600 dark:text-blue-400 hover:bg-blue-100/70 dark:hover:bg-blue-900/40"
              : "text-current hover:bg-black/5 dark:hover:bg-white/10"
          }`
        : "rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950 disabled:opacity-40 transition-all duration-150 hover:scale-105 active:scale-90"}
      onClick={(e) => { e.stopPropagation(); setBookmarked(trialId, !active, toTrialSnapshot(trial), { sourceThreadId, sourceSearchId }); }}>
      <Bookmark className={compact ? "h-3 w-3" : "h-4 w-4"} fill={active ? "currentColor" : "none"} />
    </button>;
  if (compact) return button;
  return <span className="inline-flex flex-col items-end">
    {button}
    {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
  </span>;
}

