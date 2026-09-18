"use client";

import { useState } from "react";
import { useTrialSearch } from "@/contexts/TrialSearchContext";
import type { TrialSearchCriteria, TrialSearchSort } from "@/lib/types/trialSearch";

/**
 * Shared modal for both "New search" and "Refine filters" in the Trial
 * Panel — visually mirrors MatchProfileModal.tsx (same backdrop, card,
 * gradient header/button treatment) so the whole app has one consistent
 * "structured input" modal language instead of two different UI styles.
 *
 * `mode="new"` always creates a new search identity via
 * `startNewTrialSearch` (spec section 2/8) with a fresh, mostly-blank
 * form. `mode="refine"` patches the *current* active search via
 * `updateTrialSearch` (criteria and sort together) and pre-fills from the
 * existing criteria. Both bypass the LLM entirely (spec section 5/10).
 */

const PHASE_OPTIONS = ["phase1", "phase2", "phase3", "phase4"] as const;
const SEX_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

/** Bounds for the age-range dual slider — matches typical trial eligibility spans. */
const AGE_MIN = 0;
const AGE_MAX = 120;

export function TrialSearchModal({
  mode,
  onClose,
}: {
  mode: "new" | "refine";
  onClose: () => void;
}) {
  const { search, startNewTrialSearch, updateTrialSearch } =
    useTrialSearch();
  const c = mode === "refine" ? search.criteria : {};

  const [conditions, setConditions] = useState(c.conditions?.join(", ") ?? "");
  const [city, setCity] = useState(c.city ?? "");
  const [state, setState] = useState(c.state ?? "");
  const [radius, setRadius] = useState(c.pref_distance?.toString() ?? "");
  const [sex, setSex] = useState<TrialSearchCriteria["sex"]>(c.sex ?? "all");
  // Age: mutually exclusive "exact age" vs "age range" — the trial-search
  // API only understands `age` XOR `min_age`/`max_age`, so the form must
  // never send both at once. Whichever one the existing criteria already
  // used (on refine) decides the initial mode; "range" is the default for
  // a brand-new search since it's the more common case.
  const [ageMode, setAgeMode] = useState<"range" | "exact">(
    c.age !== undefined ? "exact" : "range"
  );
  const [exactAge, setExactAge] = useState(c.age?.toString() ?? "");
  const [minAge, setMinAge] = useState(c.min_age ?? AGE_MIN);
  const [maxAge, setMaxAge] = useState(c.max_age ?? AGE_MAX);
  const [recruiting, setRecruiting] = useState(c.recruitingStatus ?? "all");
  const [phases, setPhases] = useState<string[]>(c.phases ?? []);
  const [sort, setSort] = useState<TrialSearchSort>(search.sort ?? "relevance");

  const togglePhase = (p: string) =>
    setPhases((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  // Dragging the "min" thumb past "max" (or vice versa) clamps against
  // the other handle instead of crossing over it — a plain pair of
  // number inputs would otherwise happily accept an inverted range.
  const handleMinAgeChange = (value: number) => setMinAge(Math.min(value, maxAge));
  const handleMaxAgeChange = (value: number) => setMaxAge(Math.max(value, minAge));

  const criteria: TrialSearchCriteria = {
    conditions: conditions
      ? conditions.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    city: city || undefined,
    state: state || undefined,
    pref_distance: radius ? Number(radius) : undefined,
    sex,
    age: ageMode === "exact" && exactAge ? Number(exactAge) : undefined,
    min_age:
      ageMode === "range" && (minAge > AGE_MIN || maxAge < AGE_MAX) ? minAge : undefined,
    max_age:
      ageMode === "range" && (minAge > AGE_MIN || maxAge < AGE_MAX) ? maxAge : undefined,
    recruitingStatus: recruiting === "recruiting" ? "recruiting" : "all",
    phases: phases.length ? phases : undefined,
  };

  const canSubmit = mode === "refine" || Boolean(conditions || city);

  const handleSubmit = () => {
    if (mode === "new") {
      startNewTrialSearch(criteria, "panel", sort);
    } else {
      updateTrialSearch(criteria, "panel", sort);
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="relative rounded-2xl bg-white dark:bg-[#0f1623] border border-blue-100/40 dark:border-blue-900/30 p-8">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-900/40 dark:to-sky-900/30 flex items-center justify-center shrink-0 shadow-sm">
                  <svg className="w-4 h-4 text-blue-600 fill-current" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                  {mode === "new" ? "Start a New Search" : "Refine This Search"}
                </h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {mode === "new"
                  ? "Tell us the condition and location to start a brand-new trial search."
                  : "Adjust filters on the current search — results update in place."}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4 max-h-[55vh] overflow-y-auto sidebar-scrollbar pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Condition(s)
                </label>
                <input
                  type="text"
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="e.g. Alzheimer's disease"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. San Diego"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. CA"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Radius (mi)
                  </label>
                  <input
                    type="number"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Sort
                  </label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as "relevance" | "distance")}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="distance">Distance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Sex
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SEX_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSex(opt.value)}
                      className={`w-full rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                        sex === opt.value
                          ? "border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                          : "border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Age
                  </label>
                  {/* Exact age vs age range are mutually exclusive on the
                      backend (see `criteria` above) — a small segmented
                      toggle instead of showing three inputs at once. */}
                  <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setAgeMode("range")}
                      className={`px-2.5 py-1 transition-colors ${
                        ageMode === "range"
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                      }`}
                    >
                      Range
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgeMode("exact")}
                      className={`px-2.5 py-1 transition-colors border-l border-slate-200 dark:border-slate-700 ${
                        ageMode === "exact"
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                      }`}
                    >
                      Exact
                    </button>
                  </div>
                </div>

                {ageMode === "exact" ? (
                  <input
                    type="number"
                    min={AGE_MIN}
                    max={AGE_MAX}
                    value={exactAge}
                    onChange={(e) => setExactAge(e.target.value)}
                    placeholder="e.g. 65"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                  />
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 tabular-nums">
                      <span>{minAge}{minAge === AGE_MIN ? "" : " yrs"}</span>
                      <span>
                        {maxAge >= AGE_MAX ? `${AGE_MAX}+` : maxAge} yrs
                      </span>
                    </div>
                    <div className="dual-range-slider">
                      {/* Static track + filled segment between the two thumbs, drawn separately from the (transparent-track) range inputs above it. */}
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-blue-500"
                        style={{
                          left: `${((minAge - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100}%`,
                          right: `${100 - ((maxAge - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100}%`,
                        }}
                      />
                      <input
                        type="range"
                        min={AGE_MIN}
                        max={AGE_MAX}
                        value={minAge}
                        onChange={(e) => handleMinAgeChange(Number(e.target.value))}
                        aria-label="Minimum age"
                      />
                      <input
                        type="range"
                        min={AGE_MIN}
                        max={AGE_MAX}
                        value={maxAge}
                        onChange={(e) => handleMaxAgeChange(Number(e.target.value))}
                        aria-label="Maximum age"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Recruitment status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecruiting("all")}
                    className={`w-full rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                      recruiting === "all"
                        ? "border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                        : "border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400"
                    }`}
                  >
                    All statuses
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecruiting("recruiting")}
                    className={`w-full rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                      recruiting === "recruiting"
                        ? "border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                        : "border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400"
                    }`}
                  >
                    Recruiting only
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Phase
                </label>
                <div className="flex flex-wrap gap-2">
                  {PHASE_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePhase(p)}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                        phases.includes(p)
                          ? "border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                          : "border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400"
                      }`}
                    >
                      {p.replace("phase", "Phase ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit button — same shimmer-gradient treatment as Find Your Match */}
            <div className="mt-6 shadow-lg shadow-blue-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ borderRadius: "12px" }}>
              <div className="shimmer-border-btn">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="group w-full focus:outline-none py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderRadius: "10px" }}
                >
                  <svg className="w-4 h-4 text-blue-600 fill-current" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                    {mode === "new" ? "Start New Search" : "Apply Filters"}
                  </span>
                  <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
