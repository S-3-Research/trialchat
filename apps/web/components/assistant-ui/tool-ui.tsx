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
  Loader2,
  Check,
  X,
  BookOpen,
} from "lucide-react";
import {
  ReasoningPanel,
  type ReasoningStep,
} from "@/components/assistant-ui/elements/reasoning-panel";

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
  trial_search: "Searching clinical trials",
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
 * Renders a plain-text timeline (one line per tool call, in the order
 * they ran, plus a trailing "Done" once the group finishes) instead of
 * the raw reasoning summary text or the full tool-call cards — reasoning
 * text is intentionally not displayed at all (see chat discussion: the
 * model's reasoning summary isn't reliable/stable enough to show
 * verbatim, and duplicating it via `content[]`/`additional_kwargs` was a
 * source of rendering bugs). `indices` (the group's part indices,
 * provided by `GroupedParts`) is used to look up the live `tool-call`
 * parts directly via `useAuiState`, independent of whatever `children`
 * `GroupedParts` would otherwise recursively render — so this component
 * never needs to mount the heavier `ToolCallCard`/reasoning-paragraph
 * subtree at all, collapsed or expanded.
 */
const MAX_STEP_DETAIL_LENGTH = 70;

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

const getToolStepTitle = (part: PartState & { type: "tool-call" }): string =>
  TOOL_SUMMARY_LABEL[part.toolName] ?? `Using ${part.toolName}`;

/**
 * Extra detail shown under a step's title (the `body` in `ReasoningPanel`'s
 * `{ title, body }` shape) — the search criteria/query for that specific
 * call, kept out of `title` so the timeline's title column stays a short,
 * stable label per tool rather than growing/shrinking per call. Truncated
 * since args (e.g. a long list of conditions) can otherwise overflow the
 * panel's fixed-width layout.
 */
const getToolStepDetail = (
  part: PartState & { type: "tool-call" }
): string => {
  const args = (part.args ?? {}) as Record<string, unknown>;
  if (part.toolName === "trial_search") {
    const conditions = args.conditions;
    const criteria = [
      Array.isArray(conditions) && conditions.length
        ? conditions.join(", ")
        : null,
      args.city || args.state
        ? [args.city, args.state].filter(Boolean).join(", ")
        : (args.zipcode as string | undefined) ?? null,
      args.age ? `age ${args.age}` : null,
    ].filter(Boolean);
    return criteria.length ? truncate(criteria.join(" · "), MAX_STEP_DETAIL_LENGTH) : "";
  }
  if (
    (part.toolName === "web_search" || part.toolName === "knowledge_base") &&
    typeof args.query === "string" &&
    args.query
  ) {
    return truncate(args.query, MAX_STEP_DETAIL_LENGTH);
  }
  return "";
};

type ThinkingStep = {
  key: string;
  title: string;
  detail: string;
  status: "running" | "complete" | "error";
};

const useThinkingSteps = (indices: readonly number[]): ThinkingStep[] => {
  const parts = useAuiState((s) => s.message.parts);
  return indices
    .map((i) => parts[i])
    .filter(
      (p): p is PartState & { type: "tool-call" } => p?.type === "tool-call"
    )
    // Drop calls the agent rejected for exceeding `maxCallsPerTool` (see
    // create-agent-node.ts) — these carry a real ToolMessage/part so the
    // model has something to read, but they're not an actual tool
    // invocation and would otherwise show up as a spurious extra step
    // ("Searching the web" appearing 2x for what was really one search).
    .filter(
      (p) => !(p.artifact as { rejected?: boolean } | undefined)?.rejected
    )
    .map((p) => ({
      key: p.toolCallId,
      title: getToolStepTitle(p),
      detail: getToolStepDetail(p),
      status:
        p.status.type === "running"
          ? "running"
          : p.status.type === "incomplete"
            ? "error"
            : "complete",
    }));
};

/**
 * Wraps the `@assistant-ui/elements-reasoning-panel` component (installed
 * via `npx shadcn add "@assistant-ui/elements-reasoning-panel"` — see
 * components/assistant-ui/elements/reasoning-panel.tsx) with steps derived
 * from `tool-call` parts instead of the model's raw `reasoning` part text.
 * `ReasoningPanel` itself is a pure `steps`/`open`/`streaming` props-driven
 * component with no idea where steps come from, so this is the only glue
 * needed — no fork of the installed component required.
 */
export const ThinkingAccordion: FC<{
  status: { type: string };
  indices: readonly number[];
}> = ({ status, indices }) => {
  const [open, setOpen] = useState(false);
  const [userOpened, setUserOpened] = useState(false);
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

  const steps = useThinkingSteps(indices);
  const panelSteps: ReasoningStep[] = steps.map((s) => ({
    title: s.status === "error" ? `${s.title} (failed)` : s.title,
    body: s.detail,
  }));
  if (!isRunning) panelSteps.push({ title: "Done", body: "" });

  return (
    <ReasoningPanel
      steps={panelSteps}
      visibleSteps={panelSteps.length}
      streaming={isRunning}
      open={userOpened ? open : isRunning}
      onOpenChange={(next) => {
        setUserOpened(true);
        setOpen(next);
      }}
      restingLabel={`Thought for ${elapsedSeconds}s`}
      className="max-w-none"
    />
  );
};

/**
 * Three pulsing dots shown in place of the `ThinkingAccordion` before the
 * message has any parts yet (i.e. before the model's first token/tool-call
 * has streamed in) — covers the otherwise-empty gap between the user
 * sending a message and anything appearing on screen. Animates out
 * (fade + slide up) as soon as real content starts arriving, instead of
 * abruptly disappearing.
 */
export const ThinkingDots: FC = () => {
  const parts = useAuiState((s) => s.message.parts);
  const status = useAuiState((s) => s.message.status);
  // Don't just check `parts.length === 0` — LangGraph/assistant-ui often
  // append an empty placeholder `text` part before any real token has
  // streamed in, and a branch may take a moment after that before its
  // first `reasoning`/`tool-call` part (which is what actually triggers
  // the `group-thought` accordion) arrives. Checking raw part *count*
  // caused the dots to disappear the instant that empty placeholder
  // showed up, leaving a blank gap before the accordion (or real text)
  // appeared. Instead, keep the dots up until something is actually
  // visible: non-empty text, a reasoning part, or a tool-call part.
  const hasVisibleContent = parts.some(
    (p) =>
      (p.type === "text" && p.text.trim().length > 0) ||
      p.type === "reasoning" ||
      p.type === "tool-call"
  );
  const shouldShow = !hasVisibleContent && status?.type === "running";
  const [mounted, setMounted] = useState(shouldShow);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (shouldShow) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (mounted) {
      setLeaving(true);
      const timeout = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  if (!mounted) return null;

  return (
    <div className={`thinking-dots-wrap ${leaving ? "thinking-dots-leave" : ""}`}>
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </div>
  );
};

/**
 * Thread-level counterpart to `ThinkingDots` above. `ThinkingDots` is
 * scoped to a single assistant message and can only mount once that
 * message's shell already exists — but LangGraph's `intention` classifier
 * node runs *before* any branch node appends a message, so there's a real
 * gap (classifier LLM call latency) where the thread is running yet no
 * message — assistant or otherwise — exists for it to attach to.
 *
 * This component is scoped to the *thread*, not a message, so it can cover
 * exactly that gap: it shows whenever the thread is running and the last
 * message is still the user's (i.e. no assistant message has started
 * streaming yet for this turn). As soon as the first assistant message
 * part arrives, `ThinkingDots`/`ThinkingAccordion` take over and this
 * unmounts — so at most one "thinking" indicator is ever visible at once.
 *
 * Render this once, directly under `ThreadPrimitive.Messages` in
 * `thread.tsx` (i.e. as a thread-scoped sibling, not inside a message).
 */
export const ThreadThinkingIndicator: FC = () => {
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const lastRole = useAuiState((s) => {
    const messages = s.thread.messages;
    return messages[messages.length - 1]?.role;
  });
  const shouldShow = isRunning && lastRole === "user";
  const [mounted, setMounted] = useState(shouldShow);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (shouldShow) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (mounted) {
      setLeaving(true);
      const timeout = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  if (!mounted) return null;

  return (
    <div className="max-w-[92%] w-full">
      <div className={`thinking-dots-wrap ${leaving ? "thinking-dots-leave" : ""}`}>
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </div>
    </div>
  );
};



