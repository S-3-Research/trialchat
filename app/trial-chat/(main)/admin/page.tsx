"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

const SESSION_KEY = "admin_authed";
const PASSWORD_KEY = "admin_password";

function AdminLogin({ onSuccess }: { onSuccess: (password: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem(SESSION_KEY, "1");
        sessionStorage.setItem(PASSWORD_KEY, password);
        onSuccess(password);
      } else {
        setError(data.error ?? "Incorrect password");
        setPassword("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
              <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Admin Access</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Enter password to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500/40 transition"
            />
            {error && (
              <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
            >
              {loading ? "Verifying…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface DailyPoint {
  date: string;
  count: number;
}

interface StatsData {
  total: number;
  excludedTest: boolean;
  daily: DailyPoint[];
  byType: Record<string, number>;
  byRole: Record<string, number>;
  byCta: Record<string, number>;
  byIntent: Record<string, number>;
  topUrls: { url: string; count: number }[];
}

const DAY_OPTIONS = [7, 14, 30] as const;
type DayOption = (typeof DAY_OPTIONS)[number];
const DAILY_CHART_HEIGHT = 160;

function BreakdownBar({
  label,
  count,
  max,
  color = "bg-blue-500 dark:bg-blue-400",
}: {
  label: string;
  count: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 truncate text-slate-500 dark:text-slate-400 text-xs">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-7 text-right font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">
        {count}
      </span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
        {label}
      </p>
      <p className="text-3xl font-bold text-slate-800 dark:text-white tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISODate(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function DownloadModal({ password, onClose }: { password: string; onClose: () => void }) {
  const [from, setFrom] = useState(daysAgoISODate(30));
  const [to, setTo] = useState(todayISODate());
  const [excludeTest, setExcludeTest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setError(null);
    if (!from || !to) {
      setError("Please select both start and end dates");
      return;
    }
    if (from > to) {
      setError("Start date must be before end date");
      return;
    }
    setLoading(true);
    try {
      // 'to' is a date-only string; extend to end-of-day so that day's events are included.
      const fromISO = new Date(`${from}T00:00:00.000Z`).toISOString();
      const toISO = new Date(`${to}T23:59:59.999Z`).toISOString();
      const params = new URLSearchParams({
        from: fromISO,
        to: toISO,
        exclude_test: excludeTest ? "true" : "false",
      });
      const res = await fetch(`/api/link-events/export?${params.toString()}`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `link_events_${from}_to_${to}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">Download raw data</h2>
        <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">Export link_events rows (all columns) as JSON</p>

        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">From</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 transition"
            />
          </div>
          <div>
            <label className="block mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">To</label>
            <input
              type="date"
              value={to}
              min={from}
              max={todayISODate()}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 transition"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={excludeTest}
              onChange={(e) => setExcludeTest(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500/40"
            />
            Exclude test data
          </label>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-medium py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
            >
              {loading ? "Downloading\u2026" : "Download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const storedAuthed = sessionStorage.getItem(SESSION_KEY) === "1";
    const storedPassword = sessionStorage.getItem(PASSWORD_KEY) ?? "";
    setAuthed(storedAuthed && !!storedPassword);
    setPassword(storedPassword);
    setAuthChecked(true);
  }, []);

  const [days, setDays] = useState<DayOption>(30);
  const [includeTest, setIncludeTest] = useState(false);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/link-events?days=${days}&exclude_test=${includeTest ? "false" : "true"}`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as StatsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [days, includeTest, password]);

  useEffect(() => {
    if (authed) fetchData();
  }, [fetchData, authed]);

  // Not yet checked (SSR → client hydration)
  if (!authChecked) return null;

  // Show login if not authenticated
  if (!authed) return <AdminLogin onSuccess={(pwd) => { setPassword(pwd); setAuthed(true); }} />;

  const maxDaily = data ? Math.max(...data.daily.map((d) => d.count), 1) : 1;
  const dailyTickValues = Array.from(
    new Set([0, 1, 2, 3, 4].map((step) => Math.round((maxDaily * step) / 4)))
  ).sort((a, b) => a - b);
  const maxType = data ? Math.max(...Object.values(data.byType), 1) : 1;
  const maxRole = data ? Math.max(...Object.values(data.byRole), 1) : 1;
  const maxCta = data ? Math.max(...Object.values(data.byCta), 1) : 1;
  const maxIntent = data ? Math.max(...Object.values(data.byIntent ?? {}), 1) : 1;

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar scroll-mask">
      <div className="mx-auto max-w-4xl px-6 py-10">

        {/* ── Header ── */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <Link
              href="/trial-chat"
              className="mb-3 inline-flex items-center text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
            >
              <svg className="mr-1.5 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Link Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              External click events via <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/r</code> redirect
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Include test data toggle */}
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 select-none cursor-pointer px-2">
              <input
                type="checkbox"
                checked={includeTest}
                onChange={(e) => setIncludeTest(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500/40"
              />
              Include test data
            </label>

            {/* Download raw data */}
            <button
              onClick={() => setShowDownloadModal(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              title="Download raw data"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all disabled:opacity-40"
              title="Refresh"
            >
              <svg
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            {/* Day selector */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    days === d
                      ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white ring-1 ring-black/5 dark:ring-white/10"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-600 dark:text-red-400">
            Error: {error}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && !data && (
          <div className="space-y-4 animate-pulse">
            <div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
            <div className="h-44 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
              ))}
            </div>
            <div className="h-48 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
          </div>
        )}

        {/* ── Data ── */}
        {data && (
          <div className={`space-y-5 transition-opacity duration-200 ${loading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>

            {/* Total */}
            <StatCard label={`Total clicks · last ${days} days`} value={data.total} />

            {/* Daily bar chart */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Clicks per Day
              </p>

              {data.total === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No clicks recorded yet</p>
              ) : (
                <>
                  <div className="flex gap-3">
                    <div className="flex h-[160px] w-10 flex-col justify-between text-[9px] text-slate-400 tabular-nums">
                      {dailyTickValues
                        .slice()
                        .reverse()
                        .map((tick) => (
                          <span key={tick} className="leading-none text-right">
                            {tick.toLocaleString()}
                          </span>
                        ))}
                    </div>

                    <div className="flex-1">
                      <div
                        className="relative flex items-end gap-[2px]"
                        style={{ height: `${DAILY_CHART_HEIGHT}px` }}
                      >
                        {dailyTickValues
                          .filter((tick) => tick > 0)
                          .map((tick) => {
                            const top = (tick / maxDaily) * 100;
                            return (
                              <div
                                key={tick}
                                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-slate-200 dark:border-slate-800"
                                style={{ bottom: `${top}%` }}
                              />
                            );
                          })}

                        {data.daily.map(({ date, count }) => {
                          const px = maxDaily > 0 ? (count / maxDaily) * DAILY_CHART_HEIGHT : 0;
                          return (
                            <div
                              key={date}
                              className="flex-1 h-full flex flex-col items-center justify-end group cursor-default relative z-10"
                              title={`${date}: ${count}`}
                            >
                              <div
                                className="w-full rounded-t-[2px] bg-blue-400 dark:bg-blue-500 group-hover:bg-blue-500 dark:group-hover:bg-blue-400 transition-all duration-200"
                                style={{ height: `${Math.max(px, count > 0 ? 8 : 0)}px` }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {data.daily.length > 0 && (
                        <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400 tabular-nums">
                          <span>{data.daily[0]?.date.slice(5)}</span>
                          <span>{data.daily[Math.floor(data.daily.length / 2)]?.date.slice(5)}</span>
                          <span>{data.daily[data.daily.length - 1]?.date.slice(5)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Breakdown cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* By Type */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  By Type
                </p>
                <div className="space-y-2.5">
                  {Object.entries(data.byType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([k, v]) => (
                      <BreakdownBar key={k} label={k} count={v} max={maxType} color="bg-blue-500 dark:bg-blue-400" />
                    ))}
                  {Object.keys(data.byType).length === 0 && (
                    <p className="text-xs text-slate-400">No data</p>
                  )}
                </div>
              </div>

              {/* By Role */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  By Role
                </p>
                <div className="space-y-2.5">
                  {Object.entries(data.byRole)
                    .sort(([, a], [, b]) => b - a)
                    .map(([k, v]) => (
                      <BreakdownBar key={k} label={k} count={v} max={maxRole} color="bg-violet-500 dark:bg-violet-400" />
                    ))}
                  {Object.keys(data.byRole).length === 0 && (
                    <p className="text-xs text-slate-400">No data</p>
                  )}
                </div>
              </div>

              {/* By CTA */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  By CTA
                </p>
                <div className="space-y-2.5">
                  {Object.entries(data.byCta)
                    .sort(([, a], [, b]) => b - a)
                    .map(([k, v]) => (
                      <BreakdownBar key={k} label={k} count={v} max={maxCta} color="bg-emerald-500 dark:bg-emerald-400" />
                    ))}
                  {Object.keys(data.byCta).length === 0 && (
                    <p className="text-xs text-slate-400">No data</p>
                  )}
                </div>
              </div>

              {/* By Intent */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  By Intent
                </p>
                <div className="space-y-2.5">
                  {Object.entries(data.byIntent ?? {})
                    .sort(([, a], [, b]) => b - a)
                    .map(([k, v]) => (
                      <BreakdownBar key={k} label={k} count={v} max={maxIntent} color="bg-amber-500 dark:bg-amber-400" />
                    ))}
                  {Object.keys(data.byIntent ?? {}).length === 0 && (
                    <p className="text-xs text-slate-400">No data</p>
                  )}
                </div>
              </div>
            </div>

            {/* Top URLs */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Top URLs
              </p>
              {data.topUrls.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-2.5">
                  {data.topUrls.map(({ url, count }, i) => (
                    <div key={url} className="flex items-center gap-3 text-xs group">
                      <span className="w-4 shrink-0 text-center font-mono text-slate-400">{i + 1}</span>
                      <span className="flex-1 truncate font-mono text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        {url}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {showDownloadModal && <DownloadModal password={password} onClose={() => setShowDownloadModal(false)} />}
    </div>
  );
}
