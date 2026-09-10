import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const VALID_TYPES = new Set(["http", "tel", "mailto", "sms"]);

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url, url_type, meta } = body as Record<string, unknown>;

  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  if (typeof url_type !== "string" || !VALID_TYPES.has(url_type)) {
    return NextResponse.json({ error: "Invalid url_type" }, { status: 400 });
  }

  const metaObj = (meta ?? {}) as Record<string, unknown>;
  const isTest = metaObj.is_test === true;

  const { error } = await supabase
    .from("trialchat_link_events")
    .insert({ url, url_type, meta: metaObj, is_test: isTest });

  if (error) {
    console.error("[track-link] Supabase insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
