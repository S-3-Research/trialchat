"use client";
import { useState } from "react";
import { MapPin, Check, X as XIcon, ExternalLink, MessageCircle, Cake, FileText, ClipboardList, ChevronDown } from "lucide-react";
import type { Trial } from "@/lib/types/trialSearch";
import { BookmarkButton } from "@/components/bookmarks/BookmarkButton";
import { useBookmarks } from "@/hooks/useBookmarks";
/** Normalizes inconsistent API casing (e.g. "SAN DIEGO", "san diego") to Title Case for display. */
export function toTitleCase(s: string): string {
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

export function TrialCard({
  trial,
  index,
  selected,
  asked,
  locked,
  onToggleSelect,
  onAsked,
  onAsk,
  sourceThreadId,
  sourceSearchId,
  mode = "search-results",
}: {
  trial: Trial;
  index: number;
  selected: boolean;
  asked: boolean;
  locked: boolean;
  onToggleSelect: () => void;
  onAsked: () => void;
  onAsk: (question: string) => void;
  sourceThreadId?: string;
  sourceSearchId?: string;
  mode?: "search-results" | "bookmark-snapshot";
}) {
  const [expanded, setExpanded] = useState(false);
  const [askMenuOpen, setAskMenuOpen] = useState(false);
  const { isTrialBookmarked } = useBookmarks();
  const bookmarked = mode !== "bookmark-snapshot" && !!trial.id && isTrialBookmarked(trial.id);
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
    onAsk(`${question} for "${trialLabel}".`);
  };
  // While a run is in flight, only the card(s) actually being asked about
  // stay fully interactive/visible; every other card dims under a
  // translucent mask and stops accepting clicks — makes it obvious at a
  // glance which trial the in-flight answer belongs to, and prevents
  // firing a second question (or changing selection) mid-run.
  const dimmed = locked && !asked;
  return (
    <div
      className={`relative bg-gradient-to-b from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-[24px] border-1 p-1 mb-3 animate-trial-card-enter transition-[border-color,box-shadow] duration-300 ${
        dimmed ? "cursor-default" : "cursor-pointer"
      } ${
        asked
          ? "border-emerald-400/90 dark:border-emerald-400/70 animate-trial-border-pulse"
          : selected
            ? "border-blue-300 dark:border-blue-500/50 shadow-lg shadow-blue-200/50 dark:shadow-blue-950/40"
            : "border-slate-200 dark:border-slate-700/80 shadow-lg shadow-slate-200/50 dark:shadow-black/40"
      }`}
      tabIndex={0}
      aria-label={`${trial.title ?? trial.id ?? "Trial"}${selected ? ", highlighted" : ""}`}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); if (!dimmed) onToggleSelect(); } }}
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
          {mode !== "bookmark-snapshot" && trial.id ? (
            <BookmarkButton
              trial={trial}
              sourceThreadId={sourceThreadId}
              sourceSearchId={sourceSearchId}
              pillClassName={`flex items-center gap-1 text-[0.625rem] pl-2 pr-1.5 py-1 rounded-full font-mono font-bold shrink-0 transition-colors duration-200 ${
                asked
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                  : bookmarked
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
              }`}
            >
              #{String(index + 1).padStart(2, "0")}
            </BookmarkButton>
          ) : (
            <span
              className={`flex items-center gap-1 text-[0.625rem] pl-2 pr-1.5 py-1 rounded-full font-mono font-bold shrink-0 transition-colors duration-200 ${
                asked
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
              }`}
            >
              #{String(index + 1).padStart(2, "0")}
            </span>
          )}
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

        <div className={`accordion-rows ${expanded ? "accordion-open" : "accordion-closed"}`}>
          <div>
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
          </div>
        </div>

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
            <ChevronDown
              className={`w-3.5 h-3.5 ml-0.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>
          {mode !== "bookmark-snapshot" && <div className="relative">
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
                  className="absolute right-0 bottom-full mb-1.5 z-20 w-44 rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-[0_16px_40px_-8px_rgba(15,23,42,0.35)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7)] py-1 animate-trial-menu-pop-in"
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
          </div>}
        </div>
      </div>
    </div>
  );
}

