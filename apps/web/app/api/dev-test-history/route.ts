/**
 * Dev Test History API
 *
 * GET  /api/dev-test-history          → list all runs (newest first, no results JSONB)
 * GET  /api/dev-test-history?id=uuid  → single run with full results
 * POST /api/dev-test-history          → save a new run
 * DELETE /api/dev-test-history?id=uuid → delete a run
 */

import { supabase } from "@/lib/supabase";

function checkDevAuth(request: Request): Response | null {
  const devPassword = process.env.DEV_PASSWORD;
  const provided = request.headers.get("x-dev-password");
  if (!devPassword || provided !== devPassword) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const authError = checkDevAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    // Full detail for one run
    const { data, error } = await supabase
      .from("dev_test_runs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ run: data });
  }

  // List view — omit heavy results JSONB
  const { data, error } = await supabase
    .from("dev_test_runs")
    .select(
      "id, dataset_name, dataset_id, workflow_id, workflow_name, created_at, total_tests, passed_tests, failed_tests, avg_rating, hallucination_count, widget_count"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ runs: data });
}

export async function POST(request: Request): Promise<Response> {
  const authError = checkDevAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from("dev_test_runs")
      .insert([body])
      .select("id, created_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ id: data.id, created_at: data.created_at });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const authError = checkDevAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("dev_test_runs")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
