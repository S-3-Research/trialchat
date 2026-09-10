"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DevGate from "@/components/DevGate";
import { devAuthHeaders } from "@/lib/devAuth";
import {
  FlaskConical,
  History,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  Star,
  Sparkles,
  Trash2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

interface RunListItem {
  id: string;
  dataset_name: string;
  dataset_id: string;
  workflow_id: string;
  workflow_name: string | null;
  created_at: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  avg_rating: number | null;
  hallucination_count: number;
  widget_count: number;
}

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isWidget?: boolean;
  rating?: {
    stars: number;
    hallucination: boolean;
    note: string;
  };
}

interface PerCaseMeta {
  avgRating: number | null;
  hallucinationCount: number;
  widgetCount: number;
  totalTurns: number;
  assistantTurnsCount: number;
  ratedTurnsCount: number;
}

interface ResultItem {
  testCaseId: string;
  testCaseName: string;
  status: "pending" | "running" | "success" | "error";
  duration: number | null;
  error: string | null;
  meta: PerCaseMeta;
  conversation: ConversationTurn[];
}

interface RunDetail extends RunListItem {
  results: ResultItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function RatingStars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3 h-3 ${
            s <= Math.round(value)
              ? "text-yellow-500 fill-yellow-500"
              : "text-slate-300 dark:text-slate-600"
          }`}
        />
      ))}
      <span className="text-xs text-slate-500 ml-1">{value.toFixed(1)}</span>
    </span>
  );
}

function StatusIcon({ status }: { status: ResultItem["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    case "error":
      return <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
    case "running":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />;
    default:
      return <Clock className="w-4 h-4 text-slate-400 shrink-0" />;
  }
}

// ── Main Page ──────────────────────────────────────────────────────────

function DevTestHistoryPageInner() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail state
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---- Fetch runs list ----
  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev-test-history", {
        headers: devAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setRuns(data.runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // ---- Open detail ----
  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/dev-test-history?id=${encodeURIComponent(id)}`, {
        headers: devAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setSelectedRun(data.run as RunDetail);
      setSelectedTestCaseId(data.run?.results?.[0]?.testCaseId ?? null);
    } catch (err) {
      console.error("[history] openDetail:", err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ---- Delete run ----
  const deleteRun = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Delete this test run? This cannot be undone.")) return;
      setDeletingId(id);
      try {
        const res = await fetch(
          `/api/dev-test-history?id=${encodeURIComponent(id)}`,
          { method: "DELETE", headers: devAuthHeaders() }
        );
        if (!res.ok) throw new Error("Delete failed");
        setRuns((prev) => prev.filter((r) => r.id !== id));
        if (selectedRun?.id === id) setSelectedRun(null);
      } catch (err) {
        console.error("[history] deleteRun:", err);
      } finally {
        setDeletingId(null);
      }
    },
    [selectedRun]
  );

  // ── Detail view ──────────────────────────────────────────────────────

  if (selectedRun) {
    const activeCase = selectedRun.results.find(
      (r) => r.testCaseId === selectedTestCaseId
    );

    return (
      <div className="mx-auto w-[95%] flex flex-col gap-3 flex-1 min-h-0 overflow-hidden pt-4 pb-2">
        {/* Detail Header */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSelectedRun(null)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to History
          </button>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {selectedRun.dataset_name}
          </span>
          <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
            {selectedRun.workflow_name || selectedRun.workflow_id}
          </span>
          <span className="text-xs text-slate-400">{formatDate(selectedRun.created_at)}</span>
          <div className="flex items-center gap-3 ml-auto text-xs text-slate-500">
            <span>
              <span className="text-emerald-500 font-semibold">{selectedRun.passed_tests}</span> passed
            </span>
            <span>
              <span className="text-rose-500 font-semibold">{selectedRun.failed_tests}</span> failed
            </span>
            {selectedRun.avg_rating != null && (
              <RatingStars value={selectedRun.avg_rating} />
            )}
          </div>
        </div>

        {/* 2-column layout */}
        <div className="flex flex-1 min-h-0 gap-4">
          {/* Left 1/3 — test case list */}
          <div className="w-1/3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col min-h-0 shrink-0">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Test Cases ({selectedRun.results.length})
              </h3>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 custom-scrollbar">
              {selectedRun.results.map((r) => {
                const isActive = r.testCaseId === selectedTestCaseId;
                return (
                  <button
                    key={r.testCaseId}
                    onClick={() => setSelectedTestCaseId(r.testCaseId)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-l-2 ${
                      isActive
                        ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-blue-500"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/30 border-l-transparent"
                    }`}
                  >
                    <StatusIcon status={r.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {r.testCaseName}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{formatDuration(r.duration)}</span>
                        {r.meta.avgRating != null && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            {r.meta.avgRating.toFixed(1)}
                          </span>
                        )}
                        {r.meta.hallucinationCount > 0 && (
                          <span className="flex items-center gap-0.5 text-orange-500">
                            <Sparkles className="w-3 h-3" />
                            {r.meta.hallucinationCount}
                          </span>
                        )}
                        {r.meta.widgetCount > 0 && (
                          <span className="text-purple-500 font-medium">
                            {r.meta.widgetCount}W
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 mt-0.5 transition-colors ${
                        isActive ? "text-blue-500" : "text-slate-300 dark:text-slate-600"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right 2/3 — conversation detail */}
          <div className="flex-1 min-w-0 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col min-h-0">
            {activeCase ? (
              <>
                {/* Case header */}
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center gap-3">
                  <StatusIcon status={activeCase.status} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {activeCase.testCaseName}
                  </span>
                  {activeCase.error && (
                    <span className="text-xs text-rose-400 truncate max-w-[300px]">
                      {activeCase.error}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
                    <span>{activeCase.meta.totalTurns} turns</span>
                    {activeCase.meta.avgRating != null && (
                      <RatingStars value={activeCase.meta.avgRating} />
                    )}
                    {activeCase.meta.hallucinationCount > 0 && (
                      <span className="flex items-center gap-1 text-orange-500">
                        <Sparkles className="w-3.5 h-3.5" />
                        {activeCase.meta.hallucinationCount} hallucination
                        {activeCase.meta.hallucinationCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Conversation */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {activeCase.conversation.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No conversation data
                    </div>
                  ) : (
                    activeCase.conversation.map((turn, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex gap-3">
                          <span
                            className={`text-[11px] font-semibold tracking-wide px-2 py-1.5 rounded-md shrink-0 h-fit mt-0.5 w-[52px] text-center ${
                              turn.role === "user"
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {turn.role === "user" ? "USER" : "AI"}
                          </span>
                          <div
                            className={`text-sm leading-relaxed whitespace-pre-wrap break-words min-w-0 flex-1 px-3 py-2 rounded-xl ${
                              turn.role === "user"
                                ? "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {turn.content}
                          </div>
                          {turn.isWidget && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 shrink-0 self-start mt-1.5 tracking-wide">
                              WIDGET
                            </span>
                          )}
                        </div>
                        {turn.role === "assistant" && turn.rating && (
                          <div className="ml-14 flex items-center gap-3 text-xs text-slate-500">
                            {turn.rating.stars > 0 && (
                              <RatingStars value={turn.rating.stars} />
                            )}
                            {turn.rating.hallucination && (
                              <span className="flex items-center gap-1 text-orange-500">
                                <Sparkles className="w-3 h-3" /> Hallucination
                              </span>
                            )}
                            {turn.rating.note && (
                              <span className="italic text-slate-400">
                                &ldquo;{turn.rating.note}&rdquo;
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                Select a test case on the left
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-[95%] flex flex-col gap-3 flex-1 min-h-0 overflow-hidden pt-4 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm">
              <History className="w-5 h-5" />
            </div>
            Test Run History
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Saved test runs from the Session Test Runner
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRuns}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/trial-chat/dev-test"
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Back to Test Runner
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Loading history…</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-rose-400">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm">{error}</p>
            <button
              onClick={fetchRuns}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
            >
              Retry
            </button>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <History className="w-12 h-12 opacity-30" />
            <p className="text-sm font-medium">No saved runs yet</p>
            <p className="text-xs text-slate-500">
              Use &ldquo;Save to Database&rdquo; in the Test Runner export menu
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Dataset</th>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3 text-center">Pass</th>
                  <th className="px-4 py-3 text-center">Fail</th>
                  <th className="px-4 py-3">Avg Rating</th>
                  <th className="px-4 py-3 text-center">Halluc.</th>
                  <th className="px-4 py-3 text-center">Widgets</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(run.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {run.dataset_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {run.workflow_name ? (
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-200">
                            {run.workflow_name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            {run.workflow_id}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-mono truncate">
                          {run.workflow_id}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                        {run.passed_tests}
                      </span>
                      <span className="text-slate-400 text-xs">
                        /{run.total_tests}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {run.failed_tests > 0 ? (
                        <span className="text-rose-500 font-semibold text-sm">
                          {run.failed_tests}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-sm">
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RatingStars value={run.avg_rating} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {run.hallucination_count > 0 ? (
                        <span className="text-orange-500 font-semibold text-sm flex items-center justify-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          {run.hallucination_count}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-sm">
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {run.widget_count > 0 ? (
                        <span className="text-purple-500 font-semibold text-sm">
                          {run.widget_count}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-sm">
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openDetail(run.id)}
                          disabled={detailLoading}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                        >
                          {detailLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                          Detail
                        </button>
                        <button
                          onClick={(e) => deleteRun(run.id, e)}
                          disabled={deletingId === run.id}
                          className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete run"
                        >
                          {deletingId === run.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-500 shrink-0 py-1">
        {runs.length > 0 && `${runs.length} run${runs.length > 1 ? "s" : ""} · `}
        Stored in Supabase · Showing newest first
      </div>
    </div>
  );
}

export default function DevTestHistoryPage() {
  return (
    <DevGate>
      <DevTestHistoryPageInner />
    </DevGate>
  );
}
