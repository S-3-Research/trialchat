import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

interface LinkEventRow {
  id: string;
  url: string;
  url_type: string;
  meta: Record<string, unknown>;
  is_test: boolean;
  created_at: string;
}

function dateKey(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

export async function GET(request: Request): Promise<Response> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const providedPassword = request.headers.get("x-admin-password");
  if (!adminPassword || providedPassword !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10), 1), 90);
  const excludeTest = searchParams.get("exclude_test") !== "false";

  const since = new Date();
  since.setDate(since.getDate() - days);

  let query = supabase
    .from("trialchat_link_events")
    .select("id, url, url_type, meta, is_test, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (excludeTest) {
    query = query.eq("is_test", false);
  }

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (rows ?? []) as LinkEventRow[];

  // ── Daily counts (pre-fill every day so chart has no gaps) ───────────
  const dailyMap: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyMap[dateKey(d.toISOString())] = 0;
  }
  for (const e of events) {
    const dk = dateKey(e.created_at);
    if (dk in dailyMap) dailyMap[dk]++;
  }
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // ── Breakdowns ────────────────────────────────────────────────────────
  const byType: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  const byCta: Record<string, number> = {};
  const byIntent: Record<string, number> = {};
  const urlCount: Record<string, number> = {};

  for (const e of events) {
    byType[e.url_type] = (byType[e.url_type] ?? 0) + 1;

    const role = (e.meta?.role as string) || "(none)";
    byRole[role] = (byRole[role] ?? 0) + 1;

    const cta = (e.meta?.cta as string) || "(none)";
    byCta[cta] = (byCta[cta] ?? 0) + 1;

    const intent = (e.meta?.intent as string) || "(none)";
    byIntent[intent] = (byIntent[intent] ?? 0) + 1;

    urlCount[e.url] = (urlCount[e.url] ?? 0) + 1;
  }

  const topUrls = Object.entries(urlCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  return NextResponse.json({
    total: events.length,
    excludedTest: excludeTest,
    daily,
    byType,
    byRole,
    byCta,
    byIntent,
    topUrls,
  });
}
