"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import {
  PanelRight,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { useTrialSearch } from "@/contexts/TrialSearchContext";
import type { TrialSearchState } from "@/lib/types/trialSearch";
import { TrialPanelShell, PANEL_PADDING_X } from "./TrialPanelShell";
import { TrialCard, toTitleCase } from "./TrialCard";
import { TrialSearchStartForm } from "./TrialSearchStartForm";
import { Tooltip } from "@/components/ui/Tooltip";
import { TransientBadge } from "@/components/ui/TransientBadge";

/**
 * Trial Panel is now the persistent, always-docked main surface (chat is
 * the secondary, collapsible column — see AssistantPanel.tsx, which owns
 * the chat column's width constants). It always takes the remaining flex
 * space, so there are no width constants to export here anymore.

/**
 * Single source of truth for the panel's horizontal padding (header,
 * criteria row, and the scrollable trial list all share this so they stay
 * visually aligned) — change this one value to adjust the panel's left/
 * right inset instead of hunting down each `px-5` individually.
 */


/**
 * Persistent, collapsible right-side "Trial Panel" — the structured
 * counterpart to the left chat-history sidebar. Reads/writes the shared
 * `activeTrialSearch` state via the Search Controller
 * (contexts/TrialSearchContext.tsx). All structured interactions here
 * (new search, filters, sort, load-more, select) call the controller
 * directly and never generate a synthetic Chat message or go through the
 * LLM (spec section 5/10).
 */

/**
 * Combines the active-search criteria chips and the single "Edit filters"
 * text action into one row. Previously this was two separate blocks (a
 * chip row, then a New Search / Refine Filters button pair below) — the
 * spec's core distinction (new search identity vs. patch-in-place) is a
 * *state-layer* concern, not something the UI needs to force the user to
 * choose up front: `TrialSearchModal` already receives a `mode`, so this
 * component just picks `"new"` when there's no active search yet and
 * `"refine"` once one exists, and exposes a single, unified entry point.
 *
 * Chips beyond `MAX_VISIBLE_CHIPS` collapse into a "+N more" pill whose
 * `title` attribute (native tooltip) lists the remaining criteria, so the
 * row never wraps into multiple lines just because a search has many
 * active filters.
 */
const MAX_VISIBLE_CHIPS = 3;

function buildCriteriaChips(search: TrialSearchState): string[] {
  const c = search.criteria;
  const chips: string[] = [];
  if (c.conditions?.length) chips.push(c.conditions.join(", "));
  const loc = [c.city, c.state].filter(Boolean).join(", ");
  if (loc) chips.push(c.pref_distance ? `${loc} · \u2264${c.pref_distance} mi` : loc);
  if (c.recruitingStatus === "recruiting") chips.push("Recruiting");
  if (c.intervention_types?.length) chips.push(c.intervention_types.join(" / "));
  if (c.sex && c.sex !== "all") chips.push(c.sex);
  if (c.age !== undefined) chips.push(`Age ${c.age}`);
  else if (c.min_age !== undefined || c.max_age !== undefined) {
    chips.push(`Age ${c.min_age ?? "0"}–${c.max_age ?? "∞"}`);
  }
  return chips;
}

function CriteriaRow({ onEdit, onCancel, editing }: { onEdit: () => void; onCancel: () => void; editing: boolean }) {
  const { search } = useTrialSearch();
  const chips = buildCriteriaChips(search);
  const visible = chips.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = chips.slice(MAX_VISIBLE_CHIPS);
  // Edited filters call the trial-search API directly and save straight
  // into the thread's checkpoint (contexts/TrialSearchContext.tsx), which
  // conflicts with a chat run holding the same checkpoint locked — the
  // save then gets rejected with a 409 "Thread is busy" (retried with
  // backoff, but still a confusing few-seconds-delayed save). Simplest
  // fix: don't let the user open the editor mid-run at all.
  const isRunning = useAuiState((s) => s.thread.isRunning);

  return (
    <>
      {/*
       * Two-column layout — chip column wraps freely on its own, "Edit
       * filters"/"Cancel" sits in a fixed right column, so a long/wrapping
       * set of criteria chips never pushes or reflows the button's
       * position. While editing, this same slot swaps to a "Cancel" link
       * (same style/position) rather than the form's own Apply button row
       * growing a second pinned-to-the-bottom button — keeps the control
       * that opened edit mode as the one place to back out of it too.
       */}
      <div className="grid grid-cols-[1fr_auto] items-start gap-2 mt-1">
        <div className="flex items-center flex-wrap gap-1.5 min-w-0">
          {visible.map((chip) => (
            <span
              key={chip}
              title={chip}
              className="text-xs px-2 py-1 rounded-full border border-blue-200 dark:border-blue-500/40 bg-blue-50/60 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 max-w-[9rem] truncate"
            >
              {toTitleCase(chip)}
            </span>
          ))}
          {overflow.length > 0 && (
            <span
              title={overflow.join(", ")}
              className="text-xs px-2 py-1 rounded-full border border-blue-200 dark:border-blue-500/40 bg-blue-50/60 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 cursor-default"
            >
              +{overflow.length} more
            </span>
          )}
        </div>
        {editing ? (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 flex items-center pr-2 pt-1 gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <X className="w-3 h-3" strokeWidth={2} />
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            disabled={isRunning}
            title={isRunning ? "Wait for the current chat response to finish" : undefined}
            className="shrink-0 flex items-center pr-2 pt-1 gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
          >
            <Pencil className="w-3 h-3" strokeWidth={2} />
            Edit filters
          </button>
        )}
      </div>
    </>
  );
}

function EmptyState() {
  const { search, updateTrialSearch } = useTrialSearch();
  return (
    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-4 text-sm text-slate-500 dark:text-slate-400 animate-trial-card-enter">
      <p className="mb-3">No trials match all current criteria.</p>
      <div className="flex flex-col gap-2">
        {search.criteria.pref_distance !== undefined && (
          <button
            type="button"
            onClick={() =>
              updateTrialSearch(
                { pref_distance: (search.criteria.pref_distance ?? 25) + 25 },
                "panel"
              )
            }
            className="text-left text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Increase distance to {(search.criteria.pref_distance ?? 25) + 25} mi
          </button>
        )}
        {search.criteria.recruitingStatus === "recruiting" && (
          <button
            type="button"
            onClick={() => updateTrialSearch({ recruitingStatus: "all" }, "panel")}
            className="text-left text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Include active, not recruiting
          </button>
        )}
        {search.criteria.intervention_types?.length ? (
          <button
            type="button"
            onClick={() => updateTrialSearch({ intervention_types: undefined }, "panel")}
            className="text-left text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear intervention type filter
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Shown by `TrialPanel` while `isHydrating` is true (fetch of the selected
 * thread's persisted Trial Panel state, see AssistantPanel.tsx) — a header + a couple of
 * card-shaped shimmer placeholders, matching the real layout's rough
 * proportions closely enough that the swap-in doesn't visibly jump.
 */
function TrialPanelSkeleton() {
  return (
    <div className="w-full h-full flex flex-col pt-4 pb-5 min-w-0">
      <div className={`flex items-center justify-between mb-2 shrink-0 ${PANEL_PADDING_X}`}>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Trial Panel
        </span>
      </div>
      <div className={`shrink-0 pb-3 ${PANEL_PADDING_X}`}>
        <div className="animate-pulse h-8 w-full rounded-xl bg-slate-100 dark:bg-slate-800/60" />
      </div>
      <div className={`flex-1 min-h-0 ${PANEL_PADDING_X} pt-4 space-y-3`}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse h-32 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/60"
          />
        ))}
      </div>
    </div>
  );
}

export function TrialPanel({ onAsk, headerActions, isFullscreen, onToggleFullscreen }: { onAsk?: (question: string) => void; headerActions?: ReactNode; isFullscreen?: boolean; onToggleFullscreen?: () => void }) {
  const aui = useAui();
  const remoteId = useAuiState((s) => s.optional.threadListItem?.remoteId);
  const {
    search,
    isHydrating,
    loadNextTrialSearchPage,
    toggleTrialSelection,
    markTrialAsked,
    clearAskedTrials,
    panelToast,
    showPanelToast,
  } = useTrialSearch();

  // Single subscription for the whole panel (not one per card) — the
  // "locked" state (dim + disable every card not currently being asked
  // about) is derived from the thread's run state, and clearing the
  // "being asked" set is delayed ~1.5s after the run finishes so the
  // amber pulse + dimming don't vanish the instant the answer streams in.
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const wasRunningRef = useRef(false);
  useEffect(() => {
    if (wasRunningRef.current && !isRunning) {
      const t = setTimeout(clearAskedTrials, 1500);
      wasRunningRef.current = isRunning;
      return () => clearTimeout(t);
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, clearAskedTrials]);

  // Edit-filters re-uses the same start form used for brand-new searches,
  // pre-filled with the active criteria, in place of the trial list — see
  // TrialSearchStartForm.tsx's `mode` prop.
  const [editingFilters, setEditingFilters] = useState(false);

  // Short-lived "Filters updated" confirmation next to the header — fires
  // off `search.lastChangeEvent` (set only for a successful Panel-sourced
  // refine/page, never a brand-new search or a Chat-sourced one; see
  // TrialSearchContext.tsx's `runSearch`). Keyed by `lastChangeEvent.id` so
  // this effect only re-fires on an actual new event, not every render.
  // Shares its toast state with bookmark/unbookmark confirmations (see
  // `panelToast`'s doc comment on TrialSearchApi) so both land in this
  // same header slot instead of the bookmark one floating next to
  // whichever card/button triggered it.
  const toast = panelToast;
  const show = showPanelToast;
  const lastShownChangeIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const event = search.lastChangeEvent;
    if (!event || event.id === lastShownChangeIdRef.current) return;
    lastShownChangeIdRef.current = event.id;
    show(
      event.kind === "page"
        ? `${search.pagination.total} trials shown`
        : `Filters updated \u00b7 ${search.pagination.total} match${search.pagination.total === 1 ? "" : "es"}`
    );
  }, [search.lastChangeEvent, search.pagination.total, show]);

  // Keep the previous thread's cards hidden while fetching this checkpoint.
  if (isHydrating) return <TrialPanelSkeleton />;

  const { results, pagination, status } = search;

  // TrialSearchStartForm manages its own internal scroll region (so its
  // CTA footer can stay pinned outside of it) — whenever it's the thing
  // being rendered (brand-new idle search, or refine/edit-filters mode),
  // tell the shell to skip its own scroll container/fade so the two
  // don't nest and double up the fade band at the shared edge.
  const showingStartForm = status === "idle" || editingFilters;

  return (
    <TrialPanelShell title="Trial Panel" count={pagination.total} isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} headerActions={headerActions} statusBadge={<TransientBadge toast={toast} />} description={status !== "idle" ? <CriteriaRow onEdit={() => setEditingFilters(true)} onCancel={() => setEditingFilters(false)} editing={editingFilters} /> : undefined} selfScrollingBody={showingStartForm}>
          {/*
           * Both TrialSearchStartForm usages below explicitly give it a
           * `h-full` wrapper — the form's own root uses `h-full flex
           * flex-col` internally to pin its CTA button to the bottom
           * (scrolling only the filter fields above it), which only
           * resolves correctly if its *immediate* parent has a definite
           * height. Without this, the button doesn't truly stay pinned —
           * it just happens to look fixed whenever the content is short
           * enough to not need scrolling in the first place (e.g. a
           * brand-new idle search with no criteria chips row above
           * eating space), and visibly fails once content needs to
           * scroll (e.g. refine/edit-filters mode).
           */}
          {status === "idle" && (
            <div
              className={`h-full ${isRunning ? "opacity-40 pointer-events-none transition-opacity" : "transition-opacity"}`}
              aria-busy={isRunning}
            >
              <TrialSearchStartForm onSubmitted={() => onAsk?.("")} />
            </div>
          )}

          {status !== "idle" && editingFilters && (
            <div className="h-full">
              <TrialSearchStartForm
                mode="refine"
                initialCriteria={search.criteria}
                initialSort={search.sort}
                onSubmitted={() => {
                  // Optimistic nudge: `lastChangeEvent` (and therefore the
                  // real "Filters updated" confirmation) only lands after
                  // the refine request's full round-trip resolves, which
                  // made the badge feel sluggish to appear. Showing this
                  // "Updating…" state the instant the user submits closes
                  // that gap — the success effect below overwrites it with
                  // the real message once results land.
                  show("Updating filters…", "info");
                  setEditingFilters(false);
                }}
                onCancel={() => setEditingFilters(false)}
              />
            </div>
          )}

          {!editingFilters && status === "error" && (
            <div className="text-sm text-red-600 dark:text-red-400 mb-2">
              {search.error ?? "Something went wrong."}
            </div>
          )}

          {!editingFilters && results.length === 0 && status === "success" && <EmptyState />}

          {!editingFilters && results.map((trial, i) => (
            <TrialCard
              key={trial.id ?? i}
              trial={trial}
              index={i}
              selected={(search.selectedTrialIds ?? []).includes(trial.id ?? "")}
              asked={(search.askedTrialIds ?? []).includes(trial.id ?? "")}
              locked={isRunning}
              onToggleSelect={() => trial.id && toggleTrialSelection(trial.id)}
              onAsked={() => trial.id && markTrialAsked(trial.id)}
              onAsk={(question) => {
                // Lets the parent (AssistantPanel.tsx) expand the
                // collapsed chat column so the user actually sees the
                // streamed answer, instead of it arriving behind a
                // closed panel — falls back to appending directly if no
                // `onAsk` override was supplied (e.g. bookmark snapshot
                // callers that don't need this).
                onAsk?.(question);
                aui.thread.append(question);
              }}
              sourceThreadId={remoteId}
              sourceSearchId={search.id}
            />
          ))}

          {!editingFilters && status === "searching" && results.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
              Updating results…
            </div>
          )}

          {/*
           * "Load more" lives at the bottom of the scrolling list itself
           * (not a floating footer) and merges with the loading-more
           * state: while a next-page fetch is in flight it shows the
           * spinner in the exact spot the button was, then swaps back to
           * either the button (more pages left) or the "X of Y shown"
           * summary (no pages left) once it resolves.
           */}
          {!editingFilters && results.length > 0 && (status === "success" || status === "loading-more") && (
            <div className="flex justify-center pt-1 pb-3">
              {status === "loading-more" ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                  Loading more…
                </div>
              ) : pagination.hasNextPage ? (
                <button
                  type="button"
                  onClick={() => {
                    // Same optimistic-toast rationale as the refine
                    // submit handler above — don't make the user wait
                    // for the next page's round-trip before the panel
                    // acknowledges the click.
                    show("Loading more…", "info");
                    loadNextTrialSearchPage();
                  }}
                  className="text-xs font-semibold px-4 py-2 rounded-full border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-[0_12px_32px_-8px_rgba(30,41,59,0.12)] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Load more
                </button>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {results.length} of {pagination.total || results.length} trials
                  shown
                </span>
              )}
            </div>
          )}
    </TrialPanelShell>
  );
}

/**
 * Trigger shown when the Trial Panel is collapsed. Unlike most floating
 * controls in this app, this is NOT self-positioned — it's meant to be
 * rendered inside a shared `absolute top-4 right-4 flex items-center gap-2`
 * row alongside the mobile "Find matching trials" CTA icon (see
 * AssistantPanelBody in AssistantPanel.tsx), so a widening "Trials N"
 * label here can never overlap a sibling with its own independent
 * absolute position.
 *
 * Unused now that the Trial Panel is the persistent main surface (it's
 * never collapsed), but kept around (not wired into the layout) in case a
 * future compact/mobile treatment wants it back.
 */
export function TrialPanelTrigger() {
  const { panelOpen, openPanel, search } = useTrialSearch();
  if (panelOpen) return null;
  const count = search.pagination.total;
  return (
    <Tooltip label="Open trial panel">
      <button
        onClick={openPanel}
        aria-label="Open trial panel"
        className="flex items-center justify-center gap-1.5 h-12 px-4 rounded-full bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <PanelRight className="w-4 h-4" strokeWidth={2} />
        {count > 0 && (
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            Trials {count}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
