"use client";

import { useEffect, useRef } from "react";
import { useAuiState } from "@assistant-ui/react";
import { useLangGraphSetState } from "@assistant-ui/react-langgraph";
import { useTrialSearch } from "@/contexts/TrialSearchContext";
import type { Trial, TrialSearchCriteria } from "@/lib/types/trialSearch";

/**
 * Bridges the Chat path into the shared Search Controller
 * (contexts/TrialSearchContext.tsx).
 *
 * The `trial_search` tool (apps/agent/src/tools/trial-search.tool.ts) is
 * executed by the agent itself — the web app never re-runs the search for
 * Chat-driven requests. Instead, this component watches the thread's
 * message parts for completed `trial_search` tool calls and ingests their
 * args/result into `activeTrialSearch` via `ingestChatToolResult`, so Chat
 * and the Trial Panel stay in sync without routing Panel actions through
 * the LLM (see spec section 5/6).
 *
 * Mount this once, inside <AssistantRuntimeProvider>, as a thread-scoped
 * sibling (no visual output) — mirrors `ThreadThinkingIndicator` in
 * tool-ui.tsx.
 */

type RawToolCallPart = {
  type: string;
  toolName?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status?: { type: string };
};

type GetTrialsResult = {
  success?: boolean;
  trials?: Trial[];
  total?: number;
  totalPages?: number;
  page?: number;
};

function parseResult(raw: unknown): GetTrialsResult | undefined {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as GetTrialsResult;
    } catch {
      return undefined;
    }
  }
  return raw as GetTrialsResult | undefined;
}

function argsToCriteria(args: Record<string, unknown>): TrialSearchCriteria {
  return {
    conditions: args.conditions as string[] | undefined,
    age: args.age as number | undefined,
    min_age: args.min_age as number | undefined,
    max_age: args.max_age as number | undefined,
    sex: args.sex as TrialSearchCriteria["sex"],
    city: args.city as string | undefined,
    state: args.state as string | undefined,
    county: args.county as string | undefined,
    country: args.country as string | undefined,
    zipcode: args.zipcode as string | undefined,
    street: args.street as string | undefined,
    lat: args.lat as number | undefined,
    lon: args.lon as number | undefined,
    pref_distance: args.pref_distance as number | undefined,
    drive_duration: args.drive_duration as number | undefined,
    intervention_types: args.intervention_types as string[] | undefined,
    phases: args.phases as string[] | undefined,
  };
}

/** Two searches are "the same topic" if their primary conditions overlap. */
function isRefinementOf(
  prevConditions: string[] | undefined,
  nextConditions: string[] | undefined
): boolean {
  if (!prevConditions?.length || !nextConditions?.length) return false;
  const prev = new Set(prevConditions.map((c) => c.toLowerCase()));
  return nextConditions.some((c) => prev.has(c.toLowerCase()));
}

export function TrialSearchChatBridge() {
  const messages = useAuiState((s) => s.thread.messages);
  const { search, ingestChatToolResult } = useTrialSearch();
  const processedRef = useRef<Set<string>>(new Set());
  const searchRef = useRef(search);
  searchRef.current = search;

  // Push the full (unsummarized) active-search context into the
  // LangGraph run's shared state — see `activeTrialSearch` on
  // `AgentState` (apps/agent/src/state.ts) and `create-agent-node.ts`,
  // which splices it into the model's input as a system context message
  // whenever it's set, without ever writing it back into the persisted
  // `messages` history. This is what lets Chat see Panel-only changes
  // (e.g. a filter tweaked directly in the Trial Panel, never mentioned
  // in a chat message) per spec section 10/16.
  //
  // Staged with `useLangGraphSetState` ("rides the next run input"), not
  // sent as its own message, so it costs nothing until the user's next
  // turn actually runs. Deduped via a JSON-signature ref so identical
  // consecutive states (e.g. re-renders that don't actually change
  // criteria/results) don't re-stage a redundant update.
  const setLangGraphState = useLangGraphSetState();
  const lastStagedSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (search.status === "idle") return;
    const selectedTrials = (search.selectedTrialIds ?? [])
      .map((id) => search.results.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    const payload = {
      criteria: search.criteria,
      sort: search.sort,
      pagination: search.pagination,
      results: search.results,
      selectedTrials,
      status: search.status,
    };
    const signature = JSON.stringify(payload);
    if (signature === lastStagedSignatureRef.current) return;
    lastStagedSignatureRef.current = signature;
    setLangGraphState({ activeTrialSearch: payload });
  }, [search, setLangGraphState]);

  useEffect(() => {
    for (const message of messages) {
      const parts = (message.parts ?? []) as unknown as RawToolCallPart[];
      for (const part of parts) {
        if (part.type !== "tool-call" || part.toolName !== "trial_search") continue;
        if (part.status?.type !== "complete") continue;
        const key = part.toolCallId ?? "";
        if (!key || processedRef.current.has(key)) continue;

        const result = parseResult(part.result);
        if (!result || result.success === false || !result.trials) continue;

        const criteria = argsToCriteria(part.args ?? {});
        const isNewSearch = !isRefinementOf(
          searchRef.current.criteria.conditions,
          criteria.conditions
        );
        // Refinements inherit the current (already-refined) criteria,
        // patched with whatever the agent's call specified.
        const mergedCriteria = isNewSearch
          ? criteria
          : { ...searchRef.current.criteria, ...criteria };

        processedRef.current.add(key);
        ingestChatToolResult(mergedCriteria, result.trials, {
          isNewSearch,
          total: result.total,
          totalPages: result.totalPages,
          page: result.page,
        });
      }
    }
  }, [messages, ingestChatToolResult]);

  return null;
}
