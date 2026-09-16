"use client";

import { useEffect, useState, type FC, type ReactNode } from "react";
import type {
  ToolCallMessagePartComponent,
  DataMessagePartComponent,
  PartState,
} from "@assistant-ui/react";
import { useAui, useAuiState } from "@assistant-ui/react";
import {
  Search,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Loader2,
  Check,
  X,
  BookOpen,
} from "lucide-react";

/**
 * Shared visual shell for every tool-call card (`get_trials`/`web_search`/
 * `knowledge_base` — see the three `*ToolUI` components below), so all
 * three tools look consistent instead of each hand-rolling their own
 * "running" row. Each tool passes its own `icon`, `label`
 * (query/criteria appended by the caller into `label` itself, to keep this
 * shell dumb), and `status` — this shell only handles the outer card
 * chrome, the running/done/error icon treatment, and the shimmer text
 * effect while running.
 *
 * `children` is optional extra detail content shown only once the tool
 * finishes (e.g. a source count) — errors/running/empty states are handled
 * by the icon+label row alone.
 */
const ToolCallCard: FC<{
  icon: ReactNode;
  label: ReactNode;
  running?: boolean;
  error?: boolean;
  children?: ReactNode;
}> = ({ icon, label, running, error, children }) => (
  <div
    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 my-2 ${
      error
        ? "border-red-200/70 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/10"
        : "border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900"
    }`}
  >
    <div
      className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-transform ${
        error
          ? "bg-red-100/70 dark:bg-red-500/15 text-red-500"
          : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
      } ${running ? "animate-pulse scale-105" : ""}`}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div
        className={
          running
            ? "shimmer text-foreground/60 text-[14px]"
            : "text-[14px] text-slate-600 dark:text-slate-300"
        }
      >
        {label}
      </div>
      {children}
    </div>
  </div>
);


/**
 * Rendering for the `get_trials` tool call, styled to match the "calm
 * clinical assistant" design system via the shared `ToolCallCard` shell.
 * Shows a searching state while running, a friendly error state on
 * failure, and (on success) renders nothing — the assistant's own
 * markdown reply summarizes the trials in prose instead of duplicating
 * them as cards.
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

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <ToolCallCard
    error
    icon={<AlertCircle className="w-4 h-4" strokeWidth={1.75} />}
    label={<span className="text-red-700 dark:text-red-400">{message}</span>}
  />
);

export const GetTrialsToolUI: ToolCallMessagePartComponent<
  GetTrialsArgs,
  GetTrialsResult
> = ({ args, status, result: rawResult }) => {
  if (status.type === "running" || status.type === "requires-action") {
    const a = args ?? {};
    const criteria = [
      a.conditions?.length ? a.conditions.join(", ") : null,
      a.city || a.state ? [a.city, a.state].filter(Boolean).join(", ") : a.zipcode,
      a.age ? `age ${a.age}` : null,
    ].filter(Boolean);
    return (
      <ToolCallCard
        running
        icon={<Search className="w-4 h-4" strokeWidth={1.75} />}
        label={
          <>
            Searching clinical trials
            {criteria.length > 0 ? ` — ${criteria.join(" · ")}` : ""}
          </>
        }
      />
    );
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

export const WebSearchToolUI: ToolCallMessagePartComponent<
  HostedToolArgs,
  WebSearchResult
> = ({ args, status, result: rawResult }) => {
  if (status.type === "running" || status.type === "requires-action") {
    return (
      <ToolCallCard
        running
        icon={<Search className="w-4 h-4" strokeWidth={1.75} />}
        label={<>Searching the web{args?.query ? ` — ${args.query}` : ""}</>}
      />
    );
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
      <ToolCallCard
        running
        icon={<BookOpen className="w-4 h-4" strokeWidth={1.75} />}
        label={<>Searching knowledge base{args?.query ? ` — ${args.query}` : ""}</>}
      />
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


/**
 * Generative UI renderer for the `suggestions` UI message the agent's
 * `suggestions_agent` node explicitly emits via `typedUi(config).push(...)`
 * (see apps/agent/src/nodes/suggestions.ts) — the LangGraph.js equivalent
 * of ChatKit/Agent Builder's node-returned `widget` payloads: the node
 * decides there's a UI-worthy artifact and emits `{ name, props }` itself,
 * rather than the frontend reconstructing one from a plain state field.
 *
 * Registered via `useLangGraphRuntime({ uiComponents: { renderers: {
 * suggestions: SuggestionsWidget } } })` in AssistantPanel.tsx, which
 * associates it with the `suggestions` UI message name globally for the
 * thread — assistant-ui then renders it as a `data` message part attached
 * to whichever assistant message the agent bound it to (via
 * `message: { id } }` in the `push()` call), so it appears inline under
 * that specific reply and — unlike the earlier `state.suggestions` +
 * `useLangGraphState()` approach — persists there across re-renders and
 * survives being superseded by a later turn's own suggestions, since each
 * is its own UI message tied to its own assistant message id.
 */
export const SuggestionsWidget: DataMessagePartComponent<{
  suggestions: string[];
}> = ({ data }) => {
  const aui = useAui();
  const suggestions: string[] = (data as { suggestions?: string[] } | undefined)
    ?.suggestions ?? [];

  if (!suggestions.length) return null;

  return (
    <div className="flex flex-col gap-0.5 mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-700/60">
      {suggestions.map((suggestion: string) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => aui.thread.append(suggestion)}
          className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 -mx-2.5 text-left text-[14px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
        >
          <Sparkles
            className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors"
            strokeWidth={1.75}
          />
          <span className="leading-snug">{suggestion}</span>
        </button>
      ))}
    </div>
  );
};

/**
 * Friendly, collapsed-state label per tool name — deliberately kept as a
 * small static map here rather than threaded through from the agent's
 * `activityLabel` config fields (apps/agent/src/tools/*.tool.ts), since
 * that would require plumbing agent-side metadata onto the wire just for
 * this one frontend-only label; wording is kept in sync by hand.
 */
const TOOL_SUMMARY_LABEL: Record<string, string> = {
  get_trials: "Searching clinical trials",
  web_search: "Searching the web",
  knowledge_base: "Searching knowledge base",
};

/**
 * Collapsible "Thought for Ns" wrapper for a group of adjacent
 * `reasoning`/`tool-call` parts (see thread.tsx's `AssistantMessage`,
 * grouped via `groupPartByType({ reasoning: ["group-thought"], "tool-call":
 * ["group-thought"] })`). Reproduces ChatKit's collapsed-by-default chain-
 * of-thought effect using assistant-ui's real message parts — no synthetic
 * state/widget, no message-id binding tricks.
 *
 * `reasoning` parts only exist when the underlying model runs on OpenAI's
 * Responses API with `reasoning.summary` enabled (currently the
 * knowledge/api_agent/other_questions branches on gpt-5-mini — see
 * apps/agent/src/factories/create-agent-node.ts); `tool-call` parts always
 * exist. Either or both may appear in a given group, and the elapsed time
 * shown is simply "since this component mounted" for the duration the
 * group's parts are still streaming.
 *
 * While collapsed, `children` (the full reasoning text + tool-call cards,
 * rendered by `MessagePrimitive.GroupedParts` — see thread.tsx) is NOT
 * rendered, to keep the collapsed state lightweight (no offscreen tool-call
 * card DOM). Instead, `indices` (the group's part indices, provided by
 * `GroupedParts`) is used to look up the live part data directly via
 * `useAuiState` and render a plain-text summary line per running tool-call
 * (stacked vertically when more than one tool runs in parallel) — this is
 * *only* a summary line, not a compact copy of the full tool-call card.
 */
export const ThinkingAccordion: FC<{
  children: React.ReactNode;
  status: { type: string };
  indices: readonly number[];
}> = ({ children, status, indices }) => {
  const [open, setOpen] = useState(false);
  // Tracks whether the panel has ever been opened — used to avoid mounting
  // `children` (the full reasoning text + tool-call cards) at all until
  // the user actually opens it once, keeping the collapsed state cheap.
  // Once opened, `children` stays mounted (just animated to zero height via
  // `.accordion-rows`) so re-closing/re-opening gets the smooth grid-rows
  // transition instead of a jarring mount/unmount.
  const [everOpened, setEverOpened] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isRunning = status.type === "running";

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, startedAt]);

  // Only computed/read while collapsed-and-running — the summary line is
  // pointless once expanded (children shows the real thing) or once done
  // (nothing is actively "running" to summarize).
  const parts = useAuiState((s) => s.message.parts);
  const runningToolLabels =
    !open && isRunning
      ? Array.from(
          new Set(
            indices
              .map((i) => parts[i])
              .filter(
                (p): p is PartState & { type: "tool-call" } =>
                  p?.type === "tool-call" && p.status.type === "running"
              )
              .map((p) => TOOL_SUMMARY_LABEL[p.toolName] ?? `Using ${p.toolName}`)
          )
        )
      : [];

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => {
          const next = !v;
          if (next) setEverOpened(true);
          return next;
        })}
        className="group flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
          strokeWidth={2}
        />
        {isRunning && (
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" strokeWidth={2} />
        )}
        <span className={isRunning ? "shimmer text-foreground/60" : ""}>
          {isRunning ? `Thinking for ${elapsedSeconds}s` : `Thought for ${elapsedSeconds}s`}
        </span>
      </button>
      {runningToolLabels.length > 0 ? (
        <div className="flex flex-col gap-0.5 mt-1 pl-5">
          {runningToolLabels.map((label) => (
            <span key={label} className="shimmer text-foreground/50 text-[12.5px]">
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <div className={`accordion-rows ${open ? "accordion-open" : "accordion-closed"}`}>
        <div className="flex flex-col gap-1.5 mt-1.5 pl-1.5 border-l border-slate-200/70 dark:border-slate-700/60">
          <div className="pl-2">{everOpened ? children : null}</div>
        </div>
      </div>
    </div>
  );
};


