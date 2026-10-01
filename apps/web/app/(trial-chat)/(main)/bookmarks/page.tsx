"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useBookmarks } from "@/hooks/useBookmarks";
import { TrialCard } from "@/components/assistant-ui/TrialCard";
import { createScopedThread } from "@/lib/createScopedThread";

export default function BookmarksPage() {
  const { bookmarks, ready, error, refresh } = useBookmarks();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const idsKey = JSON.stringify(bookmarks.map((b) => b.trialId));
  useEffect(() => {
    const ids = JSON.parse(idsKey) as string[];
    setSelected((prev) => prev.filter((id) => ids.includes(id)));
  }, [idsKey]);
  const start = async (ids: string[], type: "bookmark_full_snapshot" | "bookmark_picked_snapshot", title: string, prompt = title) => {
    if (busy || !ids.length) return;
    setBusy(true); setActionError(undefined);
    try {
      const trials = ids.map((id) => bookmarks.find((b) => b.trialId === id)?.trial).filter((t) => !!t);
      const id = await createScopedThread(type, ids, title, trials, prompt);
      router.push(`/chat?thread=${encodeURIComponent(id)}`);
    } catch { setActionError("Could not create the conversation. Please try again."); setBusy(false); }
  };
  const visible = bookmarks.filter((b) => {
    const t = b.trial;
    return `${b.trialId} ${t?.title ?? ""} ${t?.conditions?.join(" ") ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (status === "all" || t?.recruitment_status?.toUpperCase() === "RECRUITING");
  }).sort((a, b) => sort === "title" ? (a.trial?.title ?? a.trialId).localeCompare(b.trial?.title ?? b.trialId) : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
  const selectedIds = selected.filter((id) => bookmarks.some((b) => b.trialId === id));
  const button = "rounded-xl px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800";
  return <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 text-slate-800 dark:text-slate-100"><div className="mx-auto max-w-7xl">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6"><div><h1 className="text-3xl font-bold">Bookmarked Trials</h1><p className="mt-2 text-slate-500 dark:text-slate-400">{bookmarks.length} saved trials · Choose trials to start a new conversation.</p></div><Link href="/chat" className={button}>Back to chat</Link></div>
    <div className="flex flex-wrap gap-3 mb-4">
      <input aria-label="Search bookmarks" placeholder="Search bookmarks" value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 min-w-48 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2" />
      <div className="relative">
      <select aria-label="Filter recruitment status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${button} appearance-none pr-10 w-full bg-white dark:bg-slate-900`}><option value="all">All statuses</option><option value="recruiting">Recruiting</option></select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      </div>
      <div className="relative">
      <select aria-label="Sort bookmarks" value={sort} onChange={(e) => setSort(e.target.value)} className={`${button} appearance-none pr-10 w-full bg-white dark:bg-slate-900`}><option value="newest">Newest saved</option><option value="oldest">Oldest saved</option><option value="title">Title A–Z</option></select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <button disabled={!ready || busy || !bookmarks.length} onClick={() => start(bookmarks.map((b) => b.trialId), "bookmark_full_snapshot", `Discuss ${bookmarks.length} bookmarked ${bookmarks.length === 1 ? "trial" : "trials"}`)} className={`${button} bg-blue-600 text-white hover:bg-blue-700`}>Start chat with bookmarks</button>
      <button disabled={busy || !selectedIds.length} onClick={() => start(selectedIds, "bookmark_picked_snapshot", `Compare ${selectedIds.length} selected ${selectedIds.length === 1 ? "trial" : "trials"}`)} className={button}>Compare selected trials ({selectedIds.length})</button>
      <button className={button} onClick={() => setSelected(visible.map((b) => b.trialId))}>Select visible</button>
      {!!selected.length && <button className={button} onClick={() => setSelected([])}>Clear selection</button>}
      <button className={button} onClick={() => refresh()}>Refresh</button>
    </div>
    {(error || actionError) && <p role="alert" className="mb-4 text-red-600">{error || actionError}</p>}
    {!ready && !error && <p role="status">Loading bookmarks…</p>}
    {ready && !bookmarks.length && <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center"><h2 className="text-xl font-semibold">Keep trials you want to revisit</h2><p className="mt-2 text-slate-500">Bookmark a trial from your search results. It will appear here across your conversations.</p><Link href="/chat" className="inline-block mt-4 text-blue-600">Find clinical trials →</Link></div>}
    {!!bookmarks.length && !visible.length && <p>No bookmarks match these filters.</p>}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{visible.map((b, index) => <div key={b.trialId}>
      {!b.trial && <p role="status" className="mb-2 text-sm text-slate-500">No saved details for this trial (bookmarked before details were captured).</p>}
      <TrialCard trial={b.trial ?? { id: b.trialId, title: b.trialId }} index={index} selected={selectedIds.includes(b.trialId)} asked={false} locked={busy} onAsked={() => undefined} onToggleSelect={() => setSelected((prev) => prev.includes(b.trialId) ? prev.filter((id) => id !== b.trialId) : [...prev, b.trialId])} onAsk={(question) => start([b.trialId], "bookmark_picked_snapshot", `${question.startsWith("Explain") ? "Eligibility" : "Summary"}: ${b.trialId}`, question)} />
    </div>)}</div>
  </div></div>;
}
