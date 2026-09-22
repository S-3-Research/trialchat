import { NextRequest, NextResponse } from "next/server";

// Node.js runtime — needs to reach the agent over the Docker/host network,
// which Edge Runtime's sandboxed fetch cannot reliably do in local dev.
export const runtime = "nodejs";

const AGENT_BASE_URL =
  process.env.LANGGRAPH_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:2024";

// Optional bearer/API key forwarded to the upstream agent server. Needed
// when the agent is deployed somewhere that requires auth (e.g. LangGraph
// Platform), where every request must carry `x-api-key`. Left unset for
// self-hosted/Docker-network deployments where the agent has no auth layer
// of its own — this is purely additive so existing setups are unaffected.
const AGENT_API_KEY = process.env.LANGGRAPH_API_KEY;

/**
 * Same-origin proxy for the LangGraph Agent Server.
 *
 * The web app never talks to the agent directly from the browser — all
 * requests go through this route so that:
 *   - the real agent address (localhost:2024 / agent:2024 / production URL)
 *     never leaks to the client
 *   - we have a single place to add auth/rate limiting later
 *
 * Mirrors the "production proxy backend" pattern from the assistant-ui /
 * LangGraph SDK docs.
 */
async function handleRequest(
  req: NextRequest,
  method: string,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  const targetUrl = `${AGENT_BASE_URL}/${path.join("/")}${req.nextUrl.search}`;

  try {
    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": req.headers.get("content-type") ?? "application/json",
        ...(AGENT_API_KEY ? { "x-api-key": AGENT_API_KEY } : {}),
      },
    };
    if (method !== "GET" && method !== "HEAD") {
      init.body = await req.text();
    }

    const upstream = await fetch(targetUrl, init);

    const headers = new Headers(upstream.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.delete("transfer-encoding");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (error) {
    console.error("[api/agent] proxy error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent unreachable" },
      { status: 502 }
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export const GET = (req: NextRequest, ctx: RouteContext) =>
  handleRequest(req, "GET", ctx);
export const POST = (req: NextRequest, ctx: RouteContext) =>
  handleRequest(req, "POST", ctx);
export const PUT = (req: NextRequest, ctx: RouteContext) =>
  handleRequest(req, "PUT", ctx);
export const PATCH = (req: NextRequest, ctx: RouteContext) =>
  handleRequest(req, "PATCH", ctx);
export const DELETE = (req: NextRequest, ctx: RouteContext) =>
  handleRequest(req, "DELETE", ctx);
