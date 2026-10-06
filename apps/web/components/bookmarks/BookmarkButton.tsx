"use client";
import type { ReactNode } from "react";
import { Bookmark } from "lucide-react";
import { useBookmarks } from "@/hooks/useBookmarks";
import { toTrialSnapshot } from "@/lib/bookmarks";
import type { Trial } from "@/lib/types/trialSearch";
import { Tooltip } from "@/components/ui/Tooltip";
import { AnchoredTransientBadge } from "@/components/ui/TransientBadge";
import { useTransientToast } from "@/hooks/useTransientToast";
import { useTrialSearchOptional } from "@/contexts/TrialSearchContext";

/** `compact` renders a bare inline icon button (no padding/background), meant to be
 * embedded inside another pill/badge (e.g. the card's #NN index pill) rather than
 * standing alone. `pillClassName` instead makes the *whole* pill the button — hover/
 * press feedback and the click hit area cover the entire pill, not just the icon,
 * with `children` (e.g. the "#NN" label) rendered alongside it. `trial` is captured
 * into the bookmark as-is — it's the only copy of this trial's data any frozen
 * conversation built from it will ever see. */
export function BookmarkButton({ trial, sourceThreadId, sourceSearchId, compact, pillClassName, children }: { trial: Trial; sourceThreadId?: string; sourceSearchId?: string; compact?: boolean; pillClassName?: string; children?: ReactNode }) {
  const { ready, error, isTrialBookmarked, setBookmarked } = useBookmarks();
  const trialId = trial.id!;
  const active = isTrialBookmarked(trialId);
  // Prefer the Trial Panel's shared header toast (see `panelToast`'s doc
  // comment on TrialSearchApi) so this confirmation lands next to the
  // title the same way "Filters updated" does, instead of floating next
  // to whichever card/button triggered it. Only the standalone
  // `/bookmarks` page renders this button outside a TrialSearchProvider
  // (no Panel header to show a toast in there), so it falls back to a
  // local instance + the portal-anchored badge in that one case.
  const trialSearch = useTrialSearchOptional();
  const localToast = useTransientToast();
  const toast = trialSearch?.panelToast ?? localToast.toast;
  const show = trialSearch?.showPanelToast ?? localToast.show;
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !active;
    setBookmarked(trialId, next, toTrialSnapshot(trial), { sourceThreadId, sourceSearchId });
    show(next ? "Bookmarked" : "Bookmark removed", next ? "success" : "info");
  };

  if (pillClassName) {
    return <AnchoredTransientBadge toast={trialSearch ? null : toast}>
      <Tooltip label={active ? "Remove bookmark" : "Bookmark trial"}>
        <button type="button" disabled={!ready} aria-pressed={active} aria-label={`${active ? "Remove bookmark for" : "Bookmark"} ${trialId}`}
          className={`${pillClassName} group hover:brightness-95 dark:hover:brightness-125 active:scale-95 transition-transform duration-150 disabled:opacity-40 disabled:active:scale-100`}
          onClick={onClick}>
          {children}
          <Bookmark className="h-3 w-3 transition-transform duration-150 group-hover:scale-125" fill={active ? "currentColor" : "none"} />
        </button>
      </Tooltip>
    </AnchoredTransientBadge>;
  }

  const button = <AnchoredTransientBadge toast={trialSearch ? null : toast}>
    <Tooltip label={active ? "Remove bookmark" : "Bookmark trial"}>
      <button type="button" disabled={!ready} aria-pressed={active} aria-label={`${active ? "Remove bookmark for" : "Bookmark"} ${trialId}`}
        className={compact
          ? `rounded-full p-0.5 transition-all duration-150 hover:scale-110 active:scale-90 disabled:opacity-40 disabled:hover:scale-100 ${
              active
                ? "text-blue-600 dark:text-blue-400 hover:bg-blue-100/70 dark:hover:bg-blue-900/40"
                : "text-current hover:bg-black/5 dark:hover:bg-white/10"
            }`
          : "rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950 disabled:opacity-40 transition-all duration-150 hover:scale-105 active:scale-90"}
        onClick={onClick}>
        <Bookmark className={compact ? "h-3 w-3" : "h-4 w-4"} fill={active ? "currentColor" : "none"} />
      </button>
    </Tooltip>
  </AnchoredTransientBadge>;
  if (compact) return button;
  return <span className="inline-flex flex-col items-end">
    {button}
    {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
  </span>;
}

