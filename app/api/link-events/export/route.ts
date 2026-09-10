import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Raw export of link_events rows (all columns) within a date range.
// Query params:
//   from            ISO date/datetime (inclusive) — required
//   to              ISO date/datetime (inclusive) — required
//   exclude_test    "true" | "false" (default "false" — export includes test data by default)
export async function GET(request: Request): Promise<Response> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const providedPassword = request.headers.get("x-admin-password");
  if (!adminPassword || providedPassword !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const excludeTest = searchParams.get("exclude_test") === "true";

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: "Missing required 'from' or 'to' query param" }, { status: 400 });
  }

  const from = new Date(fromParam);
  const to = new Date(toParam);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid 'from' or 'to' date" }, { status: 400 });
  }

  // Supabase/PostgREST caps rows returned per request (commonly 1000).
  // Paginate with .range() until a page comes back short, so exports of
  // tens of thousands of rows aren't silently truncated.
  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];
  let page = 0;

  while (true) {
    let query = supabase
      .from("trialchat_link_events")
      .select("*")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (excludeTest) {
      query = query.eq("is_test", false);
    }

    const { data: batch, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    rows.push(...(batch ?? []));

    if (!batch || batch.length < PAGE_SIZE) break;
    page++;
  }

  const filename = `link_events_${fromParam.slice(0, 10)}_to_${toParam.slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(rows, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
