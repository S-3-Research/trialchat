"use client";

import type { FC } from "react";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { Search, AlertCircle } from "lucide-react";

/**
 * Rendering for the `get_trials` tool call, styled to match the "calm
 * clinical assistant" design system. Shows a searching state while running,
 * a simple editorial result list (title, status pill, locations, phases)
 * once complete, and a friendly error state on failure.
 */

type TrialLocation = {
  city?: string;
  state?: string;
  country?: string;
};

type Trial = {
  id?: string;
  title?: string;
  recruitment_status?: string;
  summary?: string;
  locations?: TrialLocation[];
  phases?: string[];
  conditions?: string[];
  rank?: number;
};

type GetTrialsArgs = {
  conditions?: string[];
  city?: string;
  state?: string;
  zipcode?: string;
  age?: number;
};

type GetTrialsResult = {
  success: boolean;
  count?: number;
  summary?: string;
  trials?: Trial[];
  error?: string;
};

const SearchingState: FC<{ args: GetTrialsArgs }> = ({ args }) => {
  const criteria = [
    args.conditions?.length ? args.conditions.join(", ") : null,
    args.city || args.state
      ? [args.city, args.state].filter(Boolean).join(", ")
      : args.zipcode,
    args.age ? `age ${args.age}` : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 px-4 py-3 my-2">
      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse">
        <Search className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className="text-[14px] text-slate-600 dark:text-slate-300">
        Searching clinical trials
        {criteria.length > 0 ? (
          <span className="text-slate-400 dark:text-slate-500"> — {criteria.join(" · ")}</span>
        ) : null}
        <span className="inline-block w-1.5 animate-pulse">…</span>
      </div>
    </div>
  );
};

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-red-200/70 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/10 px-4 py-3 my-2">
    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" strokeWidth={1.75} />
    <p className="text-[14px] text-red-700 dark:text-red-400">{message}</p>
  </div>
);

export const GetTrialsToolUI: ToolCallMessagePartComponent<
  GetTrialsArgs,
  GetTrialsResult
> = ({ args, status, result: rawResult }) => {
  if (status.type === "running" || status.type === "requires-action") {
    return <SearchingState args={args ?? {}} />;
  }

  // LangGraph's ToolNode serializes non-string tool return values to a JSON
  // string before they reach the wire; @assistant-ui/react-langgraph passes
  // that string through as `result` unchanged. Parse it back into the
  // object shape the tool actually returned.
  const result: GetTrialsResult | undefined =
    typeof rawResult === "string"
      ? ((): GetTrialsResult | undefined => {
          try {
            return JSON.parse(rawResult) as GetTrialsResult;
          } catch {
            return undefined;
          }
        })()
      : rawResult;

  if (status.type === "incomplete" || result?.success === false) {
    return (
      <ErrorState
        message={
          result?.error ??
          "Something went wrong while searching for clinical trials. Please try again."
        }
      />
    );
  }

  const trials = result?.trials ?? [];

  if (trials.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-3.5 my-2 text-[13.5px] text-slate-500 dark:text-slate-400">
        No matching trials found for that search. Try broadening the location or
        conditions.
      </div>
    );
  }

  // On success, render nothing here — the assistant's own markdown reply
  // (generated after this tool result) is left to summarize the trials in
  // prose, instead of duplicating them as cards.
  return null;
};

/**
 * Rendering for the `web_search` and `knowledge_base` tool calls (see
 * `apps/agent/src/tools/web-search.tool.ts` and
 * `knowledge-base.tool.ts`). Unlike an earlier attempt at this, these are
 * real function tools executed by the agent process itself (a standalone
 * OpenAI API call each), so — like `get_trials` — there's a genuine
 * "in progress" window while the request is in flight, and the result
 * shape is exactly what each tool's `execute()` returns.
 */

type HostedToolArgs = { query?: string };

type WebSearchResult = {
  success: boolean;
  error?: string;
  count?: number;
  sources?: { url: string; title: string }[];
};

type KnowledgeBaseResult = {
  success: boolean;
  error?: string;
  count?: number;
  results?: { filename?: string; score?: number }[];
};

function parseToolResult<T>(raw: unknown): T | undefined {
  if (typeof raw !== "string") return raw as T | undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

const HostedToolSearchingState: FC<{ label: string; query?: string }> = ({
  label,
  query,
}) => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 px-4 py-3 my-2">
    <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse">
      <Search className="w-4 h-4" strokeWidth={1.75} />
    </div>
    <div className="text-[14px] text-slate-600 dark:text-slate-300">
      {label}
      {query ? (
        <span className="text-slate-400 dark:text-slate-500"> — {query}</span>
      ) : null}
      <span className="inline-block w-1.5 animate-pulse">…</span>
    </div>
  </div>
);

export const WebSearchToolUI: ToolCallMessagePartComponent<
  HostedToolArgs,
  WebSearchResult
> = ({ args, status, result: rawResult }) => {
  if (status.type === "running" || status.type === "requires-action") {
    return <HostedToolSearchingState label="Searching the web" query={args?.query} />;
  }

  const result = parseToolResult<WebSearchResult>(rawResult);

  if (status.type === "incomplete" || result?.success === false) {
    return (
      <ErrorState
        message={result?.error ?? "Web search failed. Continuing without it."}
      />
    );
  }

  // Render nothing when there were no sources — the assistant's reply (if
  // any) already stands on its own. When sources were actually used, a
  // brief note is more transparent than staying silent (helps distinguish
  // "searched the web" from "answered from memory").
  if (!result?.count) return null;

  return (
    <div className="text-[13px] text-slate-400 dark:text-slate-500 px-1 my-1.5">
      Searched the web · {result.count} source{result.count === 1 ? "" : "s"}
    </div>
  );
};

export const KnowledgeBaseToolUI: ToolCallMessagePartComponent<
  HostedToolArgs,
  KnowledgeBaseResult
> = ({ args, status, result: rawResult }) => {
  if (status.type === "running" || status.type === "requires-action") {
    return (
      <HostedToolSearchingState label="Searching knowledge base" query={args?.query} />
    );
  }

  const result = parseToolResult<KnowledgeBaseResult>(rawResult);

  if (status.type === "incomplete" || result?.success === false) {
    return (
      <ErrorState
        message={result?.error ?? "Knowledge base search failed. Continuing without it."}
      />
    );
  }

  if (!result?.count) return null;

  return (
    <div className="text-[13px] text-slate-400 dark:text-slate-500 px-1 my-1.5">
      Searched the knowledge base · {result.count} source
      {result.count === 1 ? "" : "s"}
    </div>
  );
};
