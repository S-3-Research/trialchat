"use client";

import { useState } from "react";
import { useAui } from "@assistant-ui/react";
import { Search } from "lucide-react";
import { useTrialSearch } from "@/contexts/TrialSearchContext";
import type { TrialSearchCriteria, TrialSearchSort } from "@/lib/types/trialSearch";

/**
 * Inline "start a search" form shown in the Trial Panel's empty state —
 * i.e. when `search.status === "idle"` (a brand-new thread that hasn't
 * searched yet, NOT "a search ran and found zero results"; see
 * EmptyState in TrialPanel.tsx for that other case).
 *
 * This is the same field set as TrialSearchModal's "new search" mode,
 * pulled out of the modal and laid out directly in the panel per the
 * "trial panel is now the primary, structured way to search" direction —
 * but unlike the Panel's other structured actions (which call the
 * trial-search API directly, bypassing the LLM), submitting this form
 * deliberately goes through Chat: it composes one natural-language
 * message summarizing every filled-in filter and appends it, which both
 * creates/advances the thread and lets the agent run `trial_search` and
 * populate this same Panel the normal way (via TrialSearchChatBridge).
 */

const INTERVENTION_TYPE_OPTIONS = [
    { value: "drug", label: "Drug" },
    { value: "device", label: "Device" },
    { value: "biological/vaccine", label: "Biological / Vaccine" },
    { value: "procedure/surgery", label: "Procedure / Surgery" },
    { value: "radiation", label: "Radiation" },
    { value: "behavioral", label: "Behavioral" },
    { value: "genetic", label: "Genetic" },
    { value: "dietary_supplement", label: "Dietary Supplement" },
    { value: "combination_product", label: "Combination Product" },
    { value: "diagnostic_test", label: "Diagnostic Test" },
    { value: "other", label: "Other" },
] as const;
const SEX_OPTIONS = [
    { value: "all", label: "Any" },
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
] as const;
const RECRUITING_OPTIONS = [
    { value: "all", label: "All trials" },
    { value: "recruiting", label: "Recruiting only" },
] as const;
const AGE_MIN = 0;
const AGE_MAX = 120;

/** Builds one natural-language sentence summarizing whichever filters were filled in — the shortest path to "send the full filter content to chat". */
function buildTrialSearchMessage(criteria: TrialSearchCriteria, sort: TrialSearchSort): string {
    const parts: string[] = [];
    if (criteria.conditions?.length) parts.push(`for ${criteria.conditions.join(", ")}`);
    const loc = [criteria.city, criteria.state].filter(Boolean).join(", ");
    if (loc) parts.push(criteria.pref_distance ? `within ${criteria.pref_distance} miles of ${loc}` : `near ${loc}`);
    if (criteria.sex && criteria.sex !== "all") parts.push(`for a ${criteria.sex} patient`);
    if (criteria.age !== undefined) parts.push(`age ${criteria.age}`);
    else if (criteria.min_age !== undefined || criteria.max_age !== undefined) {
        parts.push(`ages ${criteria.min_age ?? AGE_MIN}\u2013${criteria.max_age ?? AGE_MAX}`);
    }
    if (criteria.recruitingStatus === "recruiting") parts.push("that are currently recruiting");
    if (criteria.intervention_types?.length) parts.push(`with intervention type ${criteria.intervention_types.join(" or ")}`);
    const sortSuffix = sort === "distance" ? ", sorted by distance" : "";
    return parts.length
        ? `Find clinical trials ${parts.join(", ")}${sortSuffix}.`
        : "Find clinical trials matching my criteria.";
}

export function TrialSearchStartForm({
    mode = "new",
    initialCriteria,
    initialSort,
    onSubmitted,
    onCancel,
}: {
    mode?: "new" | "refine";
    initialCriteria?: TrialSearchCriteria;
    initialSort?: TrialSearchSort;
    onSubmitted?: () => void;
    onCancel?: () => void;
}) {
    const aui = useAui();
    const { updateTrialSearch } = useTrialSearch();
    const c = initialCriteria ?? {};
    const [conditions, setConditions] = useState(c.conditions?.join(", ") ?? "");
    const [city, setCity] = useState(c.city ?? "");
    const [state, setState] = useState(c.state ?? "");
    const [radius, setRadius] = useState(c.pref_distance !== undefined ? String(c.pref_distance) : "");
    const [sex, setSex] = useState<TrialSearchCriteria["sex"]>(c.sex ?? "all");
    const [ageMode, setAgeMode] = useState<"range" | "exact">(c.age !== undefined ? "exact" : "range");
    const [exactAge, setExactAge] = useState(c.age !== undefined ? String(c.age) : "");
    const [minAge, setMinAge] = useState(c.min_age ?? AGE_MIN);
    const [maxAge, setMaxAge] = useState(c.max_age ?? AGE_MAX);
    const [recruiting, setRecruiting] = useState<"all" | "recruiting">(c.recruitingStatus === "recruiting" ? "recruiting" : "all");
    const [interventionTypes, setInterventionTypes] = useState<string[]>(c.intervention_types ?? []);
    const [sort, setSort] = useState<TrialSearchSort>(initialSort ?? "relevance");

    const toggleInterventionType = (v: string) =>
        setInterventionTypes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

    const handleMinAgeChange = (value: number) => setMinAge(Math.min(value, maxAge));
    const handleMaxAgeChange = (value: number) => setMaxAge(Math.max(value, minAge));

    const criteria: TrialSearchCriteria = {
        conditions: conditions ? conditions.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        city: city || undefined,
        state: state || undefined,
        pref_distance: radius ? Number(radius) : undefined,
        sex,
        age: ageMode === "exact" && exactAge ? Number(exactAge) : undefined,
        min_age: ageMode === "range" && (minAge > AGE_MIN || maxAge < AGE_MAX) ? minAge : undefined,
        max_age: ageMode === "range" && (minAge > AGE_MIN || maxAge < AGE_MAX) ? maxAge : undefined,
        recruitingStatus: recruiting,
        intervention_types: interventionTypes.length ? interventionTypes : undefined,
    };

    const canSubmit = mode === "refine" || Boolean(conditions || city);

    const handleSubmit = () => {
        if (!canSubmit) return;
        if (mode === "refine") {
            // Edit-filters re-uses this same form, but — like every other
            // structured Panel action — patches the existing search directly
            // via the controller instead of routing through Chat/the LLM.
            updateTrialSearch(criteria, "panel", sort);
        } else {
            aui.thread.append(buildTrialSearchMessage(criteria, sort));
        }
        onSubmitted?.();
    };

    return (
        // `h-full` here needs a parent with a *definite* height to resolve
        // against — true for the "refine" (edit-filters) usage, where this
        // component is a direct child of TrialPanelShell's own `absolute
        // inset-0` scroll container, but NOT for the "new search" (idle)
        // usage in TrialPanel.tsx, which wraps this in a plain
        // opacity/pointer-events div with no height of its own. When that
        // chain breaks, `h-full`/`flex-1` below collapse to content size
        // instead of the available box, so the CTA footer stops being
        // pinned and just scrolls away with the rest of the form instead
        // (only visible once the content is tall enough to need to
        // scroll at all — e.g. refine mode, with the criteria chips row
        // above eating extra vertical space). Fixed at the source in
        // TrialPanel.tsx by giving that wrapper `h-full` too, but this
        // component intentionally doesn't assume that — if you add a new
        // call site, make sure its immediate parent has a definite height.
        <div className="h-full flex flex-col">
            <div className="relative flex-1 min-h-0">
                <div className="absolute inset-0 overflow-y-auto sidebar-scrollbar pl-2 pr-2 pt-2 pb-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 pb-2">

            <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Condition(s)
                </label>
                <input
                    type="text"
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    placeholder="e.g. Alzheimer's disease"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
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
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
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
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
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
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Sort
                    </label>
                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as TrialSearchSort)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
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
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sex">
                    {SEX_OPTIONS.map((opt) => {
                        const checked = sex === opt.value;
                        return (
                            <label
                                key={opt.value}
                                className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm font-medium transition-all cursor-pointer ${checked
                                    ? "border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                                    : "border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400"
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    role="radio"
                                    aria-checked={checked}
                                    checked={checked}
                                    onChange={() => setSex(opt.value)}
                                    className="shrink-0 w-4 h-4 rounded accent-blue-600"
                                />
                                {opt.label}
                            </label>
                        );
                    })}
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Recruitment status
                </label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Recruitment status">
                    {RECRUITING_OPTIONS.map((opt) => {
                        const checked = recruiting === opt.value;
                        return (
                            <label
                                key={opt.value}
                                className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm font-medium transition-all cursor-pointer ${checked
                                    ? "border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                                    : "border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400"
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    role="radio"
                                    aria-checked={checked}
                                    checked={checked}
                                    onChange={() => setRecruiting(opt.value)}
                                    className="shrink-0 w-4 h-4 rounded accent-blue-600"
                                />
                                {opt.label}
                            </label>
                        );
                    })}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Age
                    </label>
                    <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[11px] font-semibold">
                        <button
                            type="button"
                            onClick={() => setAgeMode("range")}
                            className={`px-2.5 py-1 transition-colors ${ageMode === "range"
                                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                                }`}
                        >
                            Range
                        </button>
                        <button
                            type="button"
                            onClick={() => setAgeMode("exact")}
                            className={`px-2.5 py-1 transition-colors border-l border-slate-200 dark:border-slate-700 ${ageMode === "exact"
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
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                    />
                ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 pt-3 pb-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 tabular-nums">
                            <span>{minAge}{minAge === AGE_MIN ? "" : " yrs"}</span>
                            <span>{maxAge >= AGE_MAX ? `${AGE_MAX}+` : maxAge} yrs</span>
                        </div>
                        <div className="dual-range-slider">
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



            <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Intervention type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {INTERVENTION_TYPE_OPTIONS.map((opt) => {
                        const checked = interventionTypes.includes(opt.value);
                        return (
                            <label
                                key={opt.value}
                                className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm font-medium transition-all cursor-pointer ${checked
                                    ? "border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                                    : "border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400"
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleInterventionType(opt.value)}
                                    className="shrink-0 w-4 h-4 rounded accent-blue-600"
                                />
                                {opt.label}
                            </label>
                        );
                    })}
                </div>
            </div>
            </div>
                </div>
                {/* Simple gradient-overlay fade (matches TrialPanelShell's
                    approach) instead of a mask-image on the scroll
                    container — fades from this form's own background
                    (transparent, so it inherits whatever's behind it:
                    TrialPanelShell's scroll area, itself already faded at
                    its own edges) to fully transparent. */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-white dark:from-[#181D26] to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-white dark:from-[#181D26] to-transparent" />
            </div>

            {/* Big CTA — sends the full filter content to Chat (as one natural-
          language message) to create/advance the session, rather than
          calling the trial-search API directly (spec: structured Panel
          actions normally bypass the LLM, but this entry point is
          explicitly routed through Chat per the "shortest path" design).
          Pinned to the bottom of the panel, outside the scrollable filter
          area above, so it's always reachable without scrolling.
          Cancelling back out of refine mode is handled above the filter
          list instead (same spot/style as the "Edit filters" link that
          opened it — see TrialPanel.tsx's CriteriaRow), so this bar only
          ever needs the one submit action. */}
            <div className="shrink-0 pt-3 flex items-stretch gap-2">
                {/* Radius is set inline (not via the shared .shimmer-border-btn
                    CSS class's own hardcoded 12px) so it can match the Chat
                    composer's 26px. The inline style must go on THIS div —
                    the one that actually carries the shimmer-border-btn class
                    and its conic-gradient background/padding — otherwise the
                    class's own border-radius wins and the outer gradient
                    "leaks" past the inner button's rounded corners. */}
                <div className="shimmer-border-btn flex-1 shadow-lg shadow-blue-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ borderRadius: "26px" }}>
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="group w-full focus:outline-none py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-slate-900"
                            style={{ borderRadius: "24px" }}
                        >
                            <span className="flex items-center justify-center gap-2 text-sm font-bold group-disabled:opacity-40">
                                <Search className="w-4 h-4 text-blue-600" strokeWidth={2} />
                                <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                                    {mode === "refine" ? "Apply Filters" : "Start Searching"}
                                </span>
                            </span>
                        </button>
                </div>
            </div>
        </div>
    );
}
