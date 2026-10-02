"use client";

import { useEffect, useRef, useState } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import {
  PanelRight,
  Loader2,
  Pencil,
} from "lucide-react";
import { useTrialSearch } from "@/contexts/TrialSearchContext";
import type { TrialSearchState } from "@/lib/types/trialSearch";
import { TrialPanelShell, PANEL_PADDING_X } from "./TrialPanelShell";
import { TrialCard, toTitleCase } from "./TrialCard";
import { TrialSearchModal } from "@/components/assistant-ui/TrialSearchModal";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Trial Panel's width as a percentage of the overall chat+panel container
 * (see AssistantPanel.tsx, which owns the actual `width` styling for both
 * the desktop docked column and the mobile sheet) rather than a fixed
 * rem value, so "make the panel bigger" is a single-constant change and
 * both layouts stay in sync.
 */
export const TRIAL_PANEL_WIDTH_PERCENT = 38;

/**
 * Width used for the Trial Panel's mobile/"overlay" full-height sheet
 * (see AssistantPanel.tsx's `isMobile && trialPanelOpen` block) — this is
 * intentionally a SEPARATE constant from `TRIAL_PANEL_WIDTH_PERCENT`
 * rather than reusing it, since `min(${TRIAL_PANEL_WIDTH_PERCENT}%, 92%)`
 * previously meant "38% of a narrow phone viewport", i.e. a tiny sheet.
 * On mobile the panel isn't sharing width with chat (it overlays on top
 * instead), so it should read as "almost full width", capped so it
 * doesn't get absurdly wide on a tablet-sized "overlay" viewport.
 */
export const TRIAL_PANEL_MOBILE_WIDTH = "min(92%, 30rem)";

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

function CriteriaRow() {
  const { search } = useTrialSearch();
  const [modalOpen, setModalOpen] = useState(false);
  const chips = buildCriteriaChips(search);
  const visible = chips.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = chips.slice(MAX_VISIBLE_CHIPS);
  const modalMode = search.status === "idle" ? "new" : "refine";
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
       * filters" sits in a fixed right column, so a long/wrapping set of
       * criteria chips never pushes or reflows the button's position.
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
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={isRunning}
          title={isRunning ? "Wait for the current chat response to finish" : undefined}
          className="shrink-0 flex items-center pt-1 gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
        >
          <Pencil className="w-3 h-3" strokeWidth={2} />
          Edit filters
        </button>
      </div>
      {modalOpen && (
        <TrialSearchModal mode={modalMode} onClose={() => setModalOpen(false)} />
      )}
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
    <div className="w-full h-full flex flex-col pt-5 pb-5 min-w-0">
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

export function TrialPanel() {
  const aui = useAui();
  const remoteId = useAuiState((s) => s.optional.threadListItem?.remoteId);
  const {
    search,
    panelOpen,
    isHydrating,
    closePanel,
    loadNextTrialSearchPage,
    toggleTrialSelection,
    markTrialAsked,
    clearAskedTrials,
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

  if (!panelOpen) return null;

  // Keep the previous thread's cards hidden while fetching this checkpoint.
  if (isHydrating) return <TrialPanelSkeleton />;

  const { results, pagination, status } = search;

  return (
    <TrialPanelShell title="Trial Panel" count={pagination.total} onClose={closePanel} description={<CriteriaRow />}>
          {status === "idle" && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              No active trial search yet. Ask about a condition in chat, or
              use &quot;Edit filters&quot; above, to get started.
            </div>
          )}

          {status === "error" && (
            <div className="text-sm text-red-600 dark:text-red-400 mb-2">
              {search.error ?? "Something went wrong."}
            </div>
          )}

          {results.length === 0 && status === "success" && <EmptyState />}

          {results.map((trial, i) => (
            <TrialCard
              key={trial.id ?? i}
              trial={trial}
              index={i}
              selected={(search.selectedTrialIds ?? []).includes(trial.id ?? "")}
              asked={(search.askedTrialIds ?? []).includes(trial.id ?? "")}
              locked={isRunning}
              onToggleSelect={() => trial.id && toggleTrialSelection(trial.id)}
              onAsked={() => trial.id && markTrialAsked(trial.id)}
              onAsk={(question) => aui.thread.append(question)}
              sourceThreadId={remoteId}
              sourceSearchId={search.id}
            />
          ))}

          {(status === "searching" && results.length === 0) && (
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
          {results.length > 0 && (status === "success" || status === "loading-more") && (
            <div className="flex justify-center pt-1 pb-3">
              {status === "loading-more" ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                  Loading more…
                </div>
              ) : pagination.hasNextPage ? (
                <button
                  type="button"
                  onClick={() => loadNextTrialSearchPage()}
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
