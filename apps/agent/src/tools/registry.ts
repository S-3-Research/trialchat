import { z } from "zod";
import { knowledgeBaseTool } from "./knowledge-base.tool.js";
import { webSearchTool } from "./web-search.tool.js";
import { trialSearchTool } from "./trial-search.tool.js";

/**
 * A capability a node can be given access to — a tool we implement and
 * execute ourselves (e.g. calling our own clinical-trials API, or making a
 * standalone OpenAI API call for vector-store/web search). `execute` runs
 * locally; `createAgentNode` drives the request/response loop for these
 * via a real LangChain tool_call/ToolMessage round-trip — the same
 * protocol assistant-ui's tool-call UI (`tools.by_name` in
 * `thread.tsx`/`tool-ui.tsx`) already renders for `trial_search`.
 *
 * This is intentionally the *only* kind of `AgentTool` — earlier this also
 * supported "hosted" tools (OpenAI Responses API built-ins like
 * `file_search`/`web_search_preview` passed straight through to the main
 * chat model), but that path never rendered any UI reliably: those tools
 * are resolved by OpenAI inside the main model call, never appear as a
 * standard tool_call, and the assistant-ui version in this repo doesn't
 * understand their raw `additional_kwargs.tool_outputs` shape. Wrapping
 * every capability — even ones backed by an OpenAI-hosted feature under
 * the hood — as a plain function tool (see `knowledge-base.tool.ts`,
 * `web-search.tool.ts`) sidesteps that entirely.
 *
 * This is the one seam all capabilities (knowledge base, web search, trial
 * search, and anything added later — MCP, calculator, location lookup,
 * etc.) go through, so nodes/config never need to know *how* a tool works,
 * only that they have access to it.
 */
export type AgentTool<TArgs = any> = {
  name: string;
  description: string;
  // User-friendly label for the activity/reasoning-summary widget (see
  // lib/activity.ts) — e.g. "Searching clinical trials" — shown instead
  // of the raw tool name while this tool is running. Falls back to `name`
  // if omitted.
  activityLabel?: string;
  schema: z.ZodType<TArgs>;
  execute: (args: TArgs) => Promise<unknown>;
};

/** Every tool implementation the agent knows about, keyed for reuse in presets/configs. */
export const tools = {
  knowledgeBase: knowledgeBaseTool,
  webSearch: webSearchTool,
  trialSearch: trialSearchTool,
};

// `knowledge_base` requires a real vector store to search — without one,
// OpenAI rejects the request outright rather than just returning no
// results. Drop it from presets until `OPENAI_VECTOR_STORE_ID` is actually
// configured, so local/dev setups (and any env where it's not set yet)
// fall back to web search only.
const hasKnowledgeBase = Boolean(process.env.OPENAI_VECTOR_STORE_ID?.trim());
if (!hasKnowledgeBase) {
  console.warn(
    "[tools] OPENAI_VECTOR_STORE_ID not set — knowledge_base tool disabled, " +
      "falling back to web_search only."
  );
}

/**
 * Named bundles of tools for common node "roles" — lets configs stay a
 * one-liner (`tools: toolPresets.knowledge`) instead of re-listing the same
 * combination in multiple configs.
 */
export const toolPresets: Record<string, AgentTool[]> = {
  knowledge: hasKnowledgeBase
    ? [tools.knowledgeBase, tools.webSearch]
    : [tools.webSearch],
  trialMatching: [tools.trialSearch],
  none: [],
};
