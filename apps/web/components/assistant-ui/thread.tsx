"use client";

import type { FC } from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  AuiIf,
  groupPartByType,
} from "@assistant-ui/react";
import {
  ArrowUp,
  Square,
  Copy,
  RotateCcw,
  Search,
  NotebookText,
  CircleHelp,
  Sparkles,
  Mic,
} from "lucide-react";
import type { ChatStarterPrompt } from "@/lib/types/prompts";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { GetTrialsToolUI, WebSearchToolUI, KnowledgeBaseToolUI, ThinkingAccordion, ThinkingDots, ThreadThinkingIndicator } from "@/components/assistant-ui/tool-ui";

/**
 * Thread UI built from native assistant-ui primitives, styled to match the
 * "calm clinical assistant" visual direction: light cool-gray canvas, large
 * white rounded panel, soft diffuse shadows, generous whitespace, pale-blue
 * user bubbles, borderless assistant prose, and a floating pill composer.
 */
export const Thread: FC<{
  placeholder: string;
  greeting: string;
  prompts: ChatStarterPrompt[];
}> = ({ placeholder, greeting, prompts }) => {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full w-full bg-transparent">
      <ThreadPrimitive.Viewport
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 sm:px-10 pb-8 pt-16 flex flex-col gap-6"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 4.5rem, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 4.5rem, black 100%)",
        }}
      >
        <ThreadPrimitive.Empty>
          <ThreadWelcome greeting={greeting} prompts={prompts} />
        </ThreadPrimitive.Empty>

        <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
          {/*
           * Thread-scoped (not message-scoped) indicator covering the gap
           * between the user sending a message and any assistant message
           * shell existing yet — i.e. while LangGraph's `intention`
           * classifier node is running, before a branch node has appended
           * anything. See ThreadThinkingIndicator's doc comment.
           */}
          <ThreadThinkingIndicator />
        </div>
      </ThreadPrimitive.Viewport>

      <div className="shrink-0 px-6 sm:px-10 pb-6 pt-2">
        <div className="mx-auto w-full max-w-2xl">
          <Composer placeholder={placeholder} />
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
};

const PROMPT_ICONS = [Search, NotebookText, CircleHelp];

const ThreadWelcome: FC<{ greeting: string; prompts: ChatStarterPrompt[] }> = ({
  greeting,
  prompts,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-8">
      <div className="flex flex-col items-center gap-3 max-w-lg">
        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Sparkles className="w-5 h-5" strokeWidth={1.75} />
        </div>
        <p className="text-xl sm:text-2xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight leading-snug">
          {greeting}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-1 w-full max-w-md">
        {prompts.map((p, i) => {
          const Icon = PROMPT_ICONS[i % PROMPT_ICONS.length];
          return (
            <ThreadPrimitive.Suggestion
              key={p.prompt}
              prompt={p.prompt}
              send
              className="group flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 group-hover:border-blue-300 group-hover:text-blue-500 transition-colors">
                <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
              </span>
              <span className="leading-snug">{p.label}</span>
            </ThreadPrimitive.Suggestion>
          );
        })}
      </div>
    </div>
  );
};

const ToolCallFallback: FC<{ toolName: string; status: { type: string } }> = ({
  toolName,
  status,
}) => (
  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 px-4 py-3 my-2 text-[13.5px] text-slate-500 dark:text-slate-400">
    <span className="font-medium text-slate-600 dark:text-slate-300">{toolName}</span>{" "}
    {status.type === "running" ? "is running…" : `(${status.type})`}
  </div>
);
const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[85%] rounded-[22px] bg-blue-50 dark:bg-blue-500/15 text-slate-800 dark:text-slate-100 px-4 py-3 text-[15px] leading-relaxed">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="group flex justify-start">
      <div className="max-w-[92%] w-full text-slate-700 dark:text-slate-200 text-[15px] leading-[1.7]">
        {/*
         * `reasoning` parts only exist when the branch node's model runs
         * on OpenAI's Responses API with `reasoning.summary` enabled (see
         * apps/agent/src/factories/create-agent-node.ts) — currently the
         * knowledge/api_agent/other_questions branches on gpt-5-mini.
         * `tool-call` parts always exist. Both get coalesced into a single
         * collapsible "Thought for Ns" group via `groupPartByType`, which
         * groups by real adjacency in the parts array (no reordering, no
         * synthetic data messages) — see tool-ui.tsx's `ThinkingAccordion`.
         * The raw reasoning summary text itself is intentionally never
         * rendered (see tool-ui.tsx) — `ThinkingAccordion` derives its own
         * plain-text tool-call timeline directly from live part state via
         * `indices`, so `children` (the group's recursively-rendered
         * subtree) isn't needed/passed here.
         */}
        <ThinkingDots />
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ["group-thought"],
            "tool-call": ["group-thought"],
          })}
        >
          {({ part }) => {
            switch (part.type) {
              case "group-thought":
                return (
                  <ThinkingAccordion status={part.status} indices={part.indices} />
                );
              case "text":
                return <MarkdownText />;
              case "reasoning":
                // Intentionally not rendered — see comment above.
                return null;
              case "tool-call":
                // Rendered directly from the part's own fields (not via
                // `part.toolUI`) since that requires registering each tool
                // in assistant-ui's global tool-UI registry (the
                // deprecated `useAssistantToolUI` hook) — these components
                // already tolerate the raw args/result shapes LangGraph's
                // tool_call/ToolMessage protocol produces (see tool-ui.tsx).
                //
                // A call rejected by `maxCallsPerTool` (see
                // create-agent-node.ts) carries `artifact: { rejected: true
                // }` on its ToolMessage so it round-trips here as
                // `part.artifact` — it's not a real invocation (no request
                // was made), so it renders nothing rather than a spurious
                // "no results"/error card.
                if ((part.artifact as { rejected?: boolean } | undefined)?.rejected) {
                  return null;
                }
                switch (part.toolName) {
                  case "trial_search":
                    return <GetTrialsToolUI {...(part as any)} />;
                  case "web_search":
                    return <WebSearchToolUI {...(part as any)} />;
                  case "knowledge_base":
                    return <KnowledgeBaseToolUI {...(part as any)} />;
                  default:
                    return <ToolCallFallback toolName={part.toolName} status={part.status} />;
                }
              case "data":
                return part.dataRendererUI;
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <ActionBarPrimitive.Root className="flex items-center gap-1 mt-2 -ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionBarPrimitive.Copy className="flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors">
            <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.Reload className="flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
          </ActionBarPrimitive.Reload>
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
};

const Composer: FC<{ placeholder: string }> = ({ placeholder }) => {
  return (
    <ComposerPrimitive.Root className="flex flex-col gap-1.5 rounded-[26px] border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 px-3 py-2.5 shadow-[0_12px_32px_-8px_rgba(30,41,59,0.12)] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)]">
      <AuiIf condition={(s) => s.composer.dictation != null}>
        <ComposerPrimitive.DictationTranscript className="px-2 text-[13px] text-blue-500 dark:text-blue-400 italic" />
      </AuiIf>
      <div className="flex items-end gap-2">
        <ComposerPrimitive.Input
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent outline-none text-[15px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 max-h-40 px-2 py-2"
        />
        {/* Native assistant-ui dictation — enabled whenever the runtime has a
            DictationAdapter configured (see lib/voiceDictationAdapters.ts).
            Mic swaps to a pulsing stop button while a session is active. */}
        <AuiIf condition={(s) => s.thread.capabilities.dictation && s.composer.dictation == null}>
          <ComposerPrimitive.Dictate
            asChild
          >
            <button
              type="button"
              aria-label="Start voice input"
              className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:text-slate-500 dark:hover:text-blue-400 transition-colors disabled:opacity-30"
            >
              <Mic className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </ComposerPrimitive.Dictate>
        </AuiIf>
        <AuiIf condition={(s) => s.composer.dictation != null}>
          <ComposerPrimitive.StopDictation asChild>
            <button
              type="button"
              aria-label="Stop voice input"
              className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full border border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/40 dark:text-blue-400 animate-pulse transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" strokeWidth={0} />
            </button>
          </ComposerPrimitive.StopDictation>
        </AuiIf>
        <ThreadPrimitive.If running>
          <ComposerPrimitive.Cancel className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors">
            <Square className="w-3.5 h-3.5 fill-current" strokeWidth={0} />
          </ComposerPrimitive.Cancel>
        </ThreadPrimitive.If>
        <ThreadPrimitive.If running={false}>
          <ComposerPrimitive.Send className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:hover:bg-blue-600 transition-colors">
            <ArrowUp className="w-4 h-4" strokeWidth={2.25} />
          </ComposerPrimitive.Send>
        </ThreadPrimitive.If>
      </div>
    </ComposerPrimitive.Root>
  );
};
