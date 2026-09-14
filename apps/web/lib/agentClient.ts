import { Client } from "@langchain/langgraph-sdk";

/**
 * LangGraph SDK client for the Trial Chat agent.
 *
 * In the browser this always talks to our same-origin proxy at
 * /api/agent/* (see app/api/agent/[...path]/route.ts), which forwards to
 * the real Agent Server using the server-only LANGGRAPH_API_URL env var.
 * This keeps the agent's real address/API key off the client and lets the
 * same code work identically for host-based dev, Docker Compose, and
 * production.
 */
export function createAgentClient() {
  const apiUrl =
    typeof window !== "undefined"
      ? new URL("/api/agent", window.location.href).href
      : "/api/agent";

  return new Client({ apiUrl });
}

export const AGENT_ASSISTANT_ID =
  process.env.NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID?.trim() || "agent";
