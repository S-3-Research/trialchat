"use client";

import { useEffect, useRef, useState } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import {
  PanelRight,
  PanelRightClose,
  MapPin,
  Loader2,
  Check,
  X as XIcon,
  Pencil,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Cake,
  FileText,
  ClipboardList,
} from "lucide-react";
import { useTrialSearch } from "@/contexts/TrialSearchContext";
import type { Trial, TrialSearchState } from "@/lib/types/trialSearch";
import { TrialSearchModal } from "@/components/assistant-ui/TrialSearchModal";

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
const PANEL_PADDING_X = "pl-6 pr-5";

/**
 * Persistent, collapsible right-side "Trial Panel" — the structured
 * counterpart to the left chat-history sidebar. Reads/writes the shared
 * `activeTrialSearch` state via the Search Controller
 * (contexts/TrialSearchContext.tsx). All structured interactions here
 * (new search, filters, sort, load-more, select) call the controller
 * directly and never generate a synthetic Chat message or go through the
 * LLM (spec section 5/10).
 */

/** Normalizes inconsistent API casing (e.g. "SAN DIEGO", "san diego") to Title Case for display. */
function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** "phase_2_phase_3" → "Ph. 2/3"-style short form for the phase badge. */
function abbreviatePhase(phase: string): string {
  const nums = phase.match(/\d+/g);
  if (!nums?.length) return phase.replace(/_/g, " ");
  return `Phase ${nums.join("/")}`;
}

/** Shortens verbose recruitment_status enum values for the compact badge. */
function abbreviateStatus(status: string): string {
  const map: Record<string, string> = {
    recruiting: "Recruiting",
    not_yet_recruiting: "Not Yet Recruiting",
    active_not_recruiting: "Active",
    enrolling_by_invitation: "By Invitation",
    completed: "Completed",
    terminated: "Terminated",
    suspended: "Suspended",
    withdrawn: "Withdrawn",
    unknown_status: "Unknown",
  };
  return map[status.toLowerCase()] ?? status.replace(/_/g, " ");
}

function formatLocation(t: Trial): string | null {
  const loc = t.locations?.[0];
  if (!loc) return null;
  const city = loc.city ? toTitleCase(loc.city) : undefined;
  const state = loc.state ? (loc.state.length === 2 ? loc.state.toUpperCase() : toTitleCase(loc.state)) : undefined;
  return [city, state].filter(Boolean).join(", ") || (loc.country ? toTitleCase(loc.country) : null);
}

function MatchReports({ trial, asked }: { trial: Trial; asked?: boolean }) {
  if (!trial.reports?.length) return null;
  return (
    <div
      className={`flex flex-wrap gap-x-4 gap-y-2 mb-4 ${
        asked
          ? "bg-emerald-50/50 dark:bg-emerald-900/10 p-2 rounded-lg border border-emerald-100 dark:border-emerald-800/50"
          : ""
      }`}
    >
      {trial.reports.map((r) => (
        <span
          key={r.filter_type}
          title={r.result_text}
          className={`flex items-center gap-1 text-[0.6875rem] ${
            asked
              ? "font-bold text-emerald-700 dark:text-emerald-400"
              : "font-medium text-slate-500 dark:text-slate-400"
          }`}
        >
          {r.result ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
          ) : (
            <XIcon className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />
          )}
          {toTitleCase(r.filter_type.replace(/_/g, " "))}
        </span>
      ))}
    </div>
  );
}

function TrialCard({
  trial,
  index,
  selected,
  asked,
  locked,
  onToggleSelect,
  onAsked,
}: {
  trial: Trial;
  index: number;
  selected: boolean;
  asked: boolean;
  locked: boolean;
  onToggleSelect: () => void;
  onAsked: () => void;
}) {
  const aui = useAui();
  const [expanded, setExpanded] = useState(false);
  const [askMenuOpen, setAskMenuOpen] = useState(false);
  const phase = trial.phases?.[0];
  const location = formatLocation(trial);
  const trialLabel = trial.title ?? trial.id ?? "this trial";
  const isRecruiting = trial.recruitment_status?.toLowerCase() === "recruiting";

  /**
   * "Ask TrialChat" presets (Summary/Eligibility) are fire-and-forget:
   * they send a fully-formed question immediately (naming the trial
   * explicitly) and mark the trial as "being asked" via `onAsked()` — a
   * concept fully separate from the persistent multi-select: it drives a
   * distinct green pulse (not the blue selection highlight) and locks the
   * rest of the panel for the duration of the run (see TrialPanel's
   * `locked`/`askedTrialIds` handling below). Clicking the card itself
   * toggles persistent selection — highlight + composer pill — and
   * supports selecting up to MAX_SELECTED_TRIALS trials for comparison.
   */
  const sendPresetQuestion = (question: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setAskMenuOpen(false);
    if (locked) return;
    onAsked();
    aui.thread.append(`${question} for "${trialLabel}".`);
  };
  // While a run is in flight, only the card(s) actually being asked about
  // stay fully interactive/visible; every other card dims under a
  // translucent mask and stops accepting clicks — makes it obvious at a
  // glance which trial the in-flight answer belongs to, and prevents
  // firing a second question (or changing selection) mid-run.
  const dimmed = locked && !asked;
  return (
    <div
      className={`relative bg-gradient-to-b from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-[24px] border-1 p-1 mb-3 transition-shadow duration-300 ${
        dimmed ? "cursor-default" : "cursor-pointer"
      } ${
        asked
          ? "border-emerald-400/90 dark:border-emerald-400/70 animate-trial-border-pulse"
          : selected
            ? "border-blue-300 dark:border-blue-500/50 shadow-lg shadow-blue-200/50 dark:shadow-blue-950/40"
            : "border-slate-200 dark:border-slate-700/80 shadow-lg shadow-slate-200/50 dark:shadow-black/40"
      }`}
      onClick={dimmed ? undefined : onToggleSelect}
    >
      {/* Dims + locks every other card while a run is in flight. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-[24px] bg-white/60 dark:bg-slate-950/60 transition-opacity duration-300 ${
          dimmed ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`p-4 flex flex-col rounded-[20px] ${
          asked ? "bg-white dark:bg-slate-900/90 relative z-10" : ""
        }`}
      >
        {/* Top bar: recruitment-status dot + label, and #NN index badge */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isRecruiting
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                  : "bg-slate-300 dark:bg-slate-600"
              }`}
            />
            <span className="text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300 tracking-wide">
              {trial.recruitment_status
                ? toTitleCase(abbreviateStatus(trial.recruitment_status)).toUpperCase()
                : "STATUS UNKNOWN"}
            </span>
            {phase && (
              <span className="text-[0.625rem] font-bold tracking-wide px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {toTitleCase(abbreviatePhase(phase))}
              </span>
            )}
          </div>
          <span
            className={`text-[0.625rem] px-2 py-1 rounded-full font-mono font-bold shrink-0 ${
              asked
                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
            }`}
          >
            #{String(index + 1).padStart(2, "0")}
          </span>
        </div>

        {/* Typography */}
        <h3
          className={`text-[0.9375rem] font-bold leading-tight mb-1 line-clamp-2 ${
            asked ? "text-emerald-700 dark:text-emerald-400" : "text-slate-800 dark:text-white"
          }`}
        >
          {trial.title ?? "Untitled trial"}
        </h3>
        {trial.conditions?.length ? (
          <p className="text-[0.8125rem] text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">
            {trial.conditions.join(", ")}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {/* Info pills */}
        {(location || (trial.min_age !== undefined && trial.max_age !== undefined)) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {location && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full text-[0.6875rem] font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
                <MapPin
                  className={`w-3 h-3 shrink-0 ${
                    asked ? "text-emerald-500" : "text-purple-500 dark:text-purple-400"
                  }`}
                  strokeWidth={2}
                />
                {location}
              </div>
            )}
            {trial.min_age !== undefined && trial.max_age !== undefined && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full text-[0.6875rem] font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
                <Cake
                  className={`w-3 h-3 shrink-0 ${
                    asked ? "text-emerald-500" : "text-purple-500 dark:text-purple-400"
                  }`}
                  strokeWidth={2}
                />
                {trial.min_age}–{trial.max_age} yrs
              </div>
            )}
          </div>
        )}

        <MatchReports trial={trial} asked={asked} />

        {expanded && (
          <div className="mb-4 pt-3 border-t border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            {trial.eligibility_summary && (
              <p className="leading-relaxed">{trial.eligibility_summary}</p>
            )}
            {trial.links?.length ? (
              <div className="flex flex-col gap-1">
                {trial.links.map((href) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" strokeWidth={2} />
                    {href}
                  </a>
                ))}
              </div>
            ) : null}
            {!trial.eligibility_summary && !trial.links?.length && (
              <p className="text-slate-400 dark:text-slate-500">No additional details available.</p>
            )}
          </div>
        )}

        {/* Bottom actions — "View details" as a plain text link (no
            heavy button chrome, matches the reference's minimal treatment)
            and "Ask TrialChat" as a soft tinted pill (blue normally,
            emerald while `asked`) rather than a solid high-shadow button —
            this row is a secondary action, not the primary card CTA. */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors inline-flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            View details
            <ChevronRight
              className={`w-3.5 h-3.5 ml-0.5 transition-transform ${expanded ? "rotate-90" : ""}`}
              strokeWidth={2}
            />
          </button>
          <div className="relative">
            <button
              type="button"
              disabled={locked}
              title={locked ? "Wait for the current response to finish" : undefined}
              className={`text-xs font-semibold transition-colors px-3 py-1.5 rounded-md flex items-center gap-1.5 ${
                locked
                  ? "text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                  : asked
                    ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
                    : "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (locked) return;
                setAskMenuOpen((v) => !v);
              }}
            >
              <MessageCircle className="w-3.5 h-3.5" strokeWidth={2} />
              Ask TrialChat
            </button>
            {askMenuOpen && (
              <>
                {/* Click-outside backdrop — stopPropagation on the menu itself
                    keeps clicks inside from also selecting the card underneath. */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAskMenuOpen(false);
                  }}
                />
                {/* Absolutely positioned (not inline flow) so opening the menu
                    floats over the panel instead of growing the card's own
                    height and shifting every card below it down. */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-full mb-1.5 z-20 w-44 rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-[0_16px_40px_-8px_rgba(15,23,42,0.35)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7)] py-1"
                >
                  <button
                    type="button"
                    onClick={sendPresetQuestion("Give me a plain-language summary")}
                    className="flex w-full items-center gap-2 text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" strokeWidth={2} />
                    Summary
                  </button>
                  <button
                    type="button"
                    onClick={sendPresetQuestion("Explain the eligibility criteria in plain language")}
                    className="flex w-full items-center gap-2 text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <ClipboardList className="w-3.5 h-3.5 shrink-0 opacity-70" strokeWidth={2} />
                    Eligibility
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  if (c.phases?.length) chips.push(c.phases.join(" / "));
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
      <div className="flex items-center flex-wrap gap-1.5 mt-1">
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
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={isRunning}
          title={isRunning ? "Wait for the current chat response to finish" : undefined}
          className="ml-auto shrink-0 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
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
    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
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
        {search.criteria.phases?.length ? (
          <button
            type="button"
            onClick={() => updateTrialSearch({ phases: undefined }, "panel")}
            className="text-left text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear phase filter
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
    <div className="w-full h-full flex flex-col pt-5 pb-5 min-w-0">
      <div className={`flex items-center justify-between mb-2 shrink-0 ${PANEL_PADDING_X}`}>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Trial Panel
          {pagination.total > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-bold">
              {pagination.total}
            </span>
          )}
        </span>
        <button
          onClick={closePanel}
          aria-label="Collapse trial panel"
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <PanelRightClose className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      <div className={`shrink-0 pb-3 ${PANEL_PADDING_X}`}>
        <CriteriaRow />
      </div>

      {/*
       * Scroll region hugs the panel's own edges (no extra gutter before
       * the scrollbar — see `.sidebar-scrollbar` in globals.css) and fades
       * top/bottom via mask-image, mirroring the chat viewport's treatment
       * in thread.tsx so both columns share the same "content fades under
       * chrome" language.
       */}
      <div className="relative flex-1 min-h-0">
        <div
          className={`absolute inset-0 overflow-y-auto sidebar-scrollbar ${PANEL_PADDING_X} pt-4 pb-2`}
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent, black 1rem, black calc(100% - 1rem), transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, black 1rem, black calc(100% - 1rem), transparent 100%)",
          }}
        >
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
        </div>
      </div>
    </div>
  );
}

/** Floating trigger shown when the Trial Panel is collapsed. */
export function TrialPanelTrigger() {
  const { panelOpen, openPanel, search } = useTrialSearch();
  if (panelOpen) return null;
  const count = search.pagination.total;
  return (
    <button
      onClick={openPanel}
      aria-label="Open trial panel"
      className="absolute top-4 right-4 z-20 flex items-center justify-center gap-1.5 h-12 px-4 rounded-full bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
    >
      <PanelRight className="w-4 h-4" strokeWidth={2} />
      {count > 0 && (
        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
          Trials {count}
        </span>
      )}
    </button>
  );
}
