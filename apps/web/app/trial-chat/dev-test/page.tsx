"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  MessageSquare,
  Download,
  Sparkles,
  Play,
  Square,
  CheckSquare,
  MinusSquare,
  X,
  PanelRightClose,
  PanelRightOpen,
  Star,
  ChevronDown,
  Eye,
  History,
  Database,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import DevGate from "@/components/DevGate";
import { devAuthHeaders } from "@/lib/devAuth";
import {
  WORKFLOW_ID,
  CREATE_SESSION_ENDPOINT,
  PLACEHOLDER_INPUT,
  getThemeConfig,
  getStarterPromptsForUser,
  getGreetingForUser,
} from "@/lib/config";
import { IntakeData } from "@/lib/types/intake";
import { resolvePrompts } from "@/lib/types/prompts";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { useFontSize } from "@/contexts/FontSizeContext";

// ── Types ──────────────────────────────────────────────────────────────

interface TestCase {
  id: string;
  name: string;
  description?: string;
  messages: string[];
}

interface TestDataset {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
}

interface TurnRating {
  stars: number; // 0-5
  hallucination: boolean;
  note: string;
}

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  rating?: TurnRating;
  isWidget?: boolean;
}

interface TestResult {
  testCaseId: string;
  testCaseName: string;
  status: "pending" | "running" | "success" | "error";
  conversation: ConversationTurn[];
  error?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

type RunnerStatus = "idle" | "running" | "completed" | "stopped";

// ── Datasets ───────────────────────────────────────────────────────────

import basicDataset from "@/data/test-datasets/basic.json";
import clinicalTrialsDataset from "@/data/test-datasets/clinical-trials.json";
import edgeCasesDataset from "@/data/test-datasets/edge-cases.json";

const ALL_DATASETS: TestDataset[] = [
  basicDataset as TestDataset,
  clinicalTrialsDataset as TestDataset,
  edgeCasesDataset as TestDataset,
];

// ── Workflow Presets ───────────────────────────────────────────────────

const WORKFLOW_PRESETS: { id: string; name: string }[] = [
  // Add your workflow presets here, e.g.:
  { id: "wf_68e40129687881909cb2491e48e40fb50d778612cf5adf60", name: "Trial Chat" },
  // { id: "flow_yyyyyyyyyyyy", name: "General Q&A" },
];

// ── Default Intake Data ────────────────────────────────────────────────

const DEFAULT_INTAKE_DATA: IntakeData = {
  role: "user",
  response_style: "balanced",
  intent: "trial_matching",
};

// ── Helpers ────────────────────────────────────────────────────────────

interface PerCaseMeta {
  avgRating: number | null;
  hallucinationCount: number;
  widgetCount: number;
  ratedTurnsCount: number;
  assistantTurnsCount: number;
  totalTurns: number;
}

function computePerCaseMeta(r: TestResult): PerCaseMeta {
  const assistantTurns = r.conversation.filter((t) => t.role === "assistant");
  const ratedTurns = assistantTurns.filter(
    (t) => t.rating && t.rating.stars > 0
  );
  const avgRating =
    ratedTurns.length > 0
      ? parseFloat(
        (
          ratedTurns.reduce((sum, t) => sum + t.rating!.stars, 0) /
          ratedTurns.length
        ).toFixed(1)
      )
      : null;
  const hallucinationCount = assistantTurns.filter(
    (t) => t.rating?.hallucination
  ).length;
  const widgetCount = r.conversation.filter((t) => t.isWidget).length;
  return {
    avgRating,
    hallucinationCount,
    widgetCount,
    ratedTurnsCount: ratedTurns.length,
    assistantTurnsCount: assistantTurns.length,
    totalTurns: r.conversation.length,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusIcon(status: TestResult["status"]) {
  switch (status) {
    case "pending":
      return <Clock className="w-4 h-4 text-slate-400" />;
    case "running":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case "success":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case "error":
      return <XCircle className="w-4 h-4 text-rose-500" />;
  }
}

/**
 * ChatKit renders inside a cross-origin iframe (cdn.platform.openai.com).
 * We CANNOT access the iframe's DOM (contentDocument is null).
 * ChatKit events (onResponseEnd) provide NO response text (void).
 * PostMessage events also carry NO response text (response field is undefined).
 *
 * Strategy: Capture the thread ID from chatkit.thread.change event, then
 * after each onResponseEnd, query the OpenAI API server-side via
 * /api/thread-messages to retrieve the actual conversation text.
 */

// ── ChatKit Test Session Component ─────────────────────────────────────

interface TestSessionProps {
  testCase: TestCase;
  workflowId: string;
  containerId: string;
  colorScheme: "dark" | "light";
  baseFontSize: 14 | 16 | 18;
  intakeData: IntakeData;
  onComplete: (testCaseId: string, conversation: ConversationTurn[], error?: string, chatEndTime?: number) => void;
  onProgress: (testCaseId: string, msgIndex: number, total: number) => void;
}

const TestSession = React.memo(function TestSession({
  testCase,
  workflowId,
  containerId,
  colorScheme,
  baseFontSize,
  intakeData,
  onComplete,
  onProgress,
}: TestSessionProps) {
  const msgIdxRef = useRef(0);
  const isCompleteRef = useRef(false);
  const threadIdRef = useRef<string | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);

  const [tick, setTick] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // ---- Capture threadId from postMessage ----
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object" || !data.__oaiChatKit) return;
      if (
        data.type === "event" &&
        Array.isArray(data.data) &&
        data.data[0] === "thread.change" &&
        data.data[1]?.threadId
      ) {
        threadIdRef.current = data.data[1].threadId as string;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ---- getClientSecret ----
  const getClientSecret = useCallback(async () => {
    const res = await fetch(CREATE_SESSION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow: { id: workflowId },
        guest_user_id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        is_test: true,
        intake_data: intakeData,
        chatkit_configuration: { file_upload: { enabled: true } },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.client_secret) throw new Error(data.error?.message || "Failed to create session");
    return data.client_secret as string;
  }, [workflowId, intakeData]);

  // ---- Fetch ALL thread messages once at the end ----
  const fetchAllMessages = useCallback(async (): Promise<ConversationTurn[]> => {
    const threadId = threadIdRef.current;
    if (!threadId) return [];
    try {
      const res = await fetch("/api/thread-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId }),
      });
      const data = await res.json();
      if (data.messages && Array.isArray(data.messages)) {
        return data.messages.map((m: { role: string; content: string; isWidget?: boolean }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: Date.now(),
          isWidget: m.isWidget || false,
        }));
      }
      return [];
    } catch { return []; }
  }, []);

  // ---- ChatKit hook ----
  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: { colorScheme, ...getThemeConfig(colorScheme, baseFontSize) },
    startScreen: {
      greeting: getGreetingForUser(intakeData),
      prompts: resolvePrompts(getStarterPromptsForUser(intakeData), false),
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
      attachments: { enabled: true },
    },
    threadItemActions: {
      feedback: true,
      retry: true,
    },
    onClientTool: async (invocation: { name: string; params: Record<string, unknown> }) => {
      try {
        const response = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolName: invocation.name,
            params: invocation.params,
          }),
        });
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType?.includes("application/json")) {
          return { success: false, error: `API error (${response.status})` };
        }
        return await response.json();
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Tool call failed" };
      }
    },
    onResponseStart: () => {
      // Cancel any pending advance — a new generation is starting (e.g. tool result processing).
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      busyRef.current = true;
    },
    onResponseEnd: () => {
      busyRef.current = false;
      // Debounce: if another onResponseStart fires within 400ms, the timer will be
      // cancelled above and rescheduled after that generation ends — regardless of
      // how many tool-chained generations occur. Only the final end triggers advance.
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        if (busyRef.current) return; // extra safety
        msgIdxRef.current++;
        setTick((t) => t + 1);
      }, 400);
    },
    onThreadChange: ({ threadId }: { threadId: string | null }) => {
      if (threadId) threadIdRef.current = threadId;
    },
    onError: ({ error }: { error: unknown }) => {
      console.error("[TestSession] ChatKit error:", error);
      busyRef.current = false;
      if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
      if (!isCompleteRef.current) {
        isCompleteRef.current = true;
        onComplete(testCase.id, [], error instanceof Error ? error.message : "ChatKit error");
      }
    },
  });

  // ---- Detect session ready ----
  useEffect(() => {
    if (chatkit.control && !isReady) {
      const timer = setTimeout(() => setIsReady(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [chatkit.control, isReady]);

  // ---- Send messages sequentially (driven by tick) ----
  useEffect(() => {
    if (!isReady || busyRef.current) return;
    const idx = msgIdxRef.current;
    if (idx < testCase.messages.length) {
      busyRef.current = true;
      const msg = testCase.messages[idx];
      onProgress(testCase.id, idx, testCase.messages.length);

      chatkit.sendUserMessage({ text: msg }).catch((err: unknown) => {
        console.error("[TestSession] sendUserMessage error:", err);
        busyRef.current = false;
        if (!isCompleteRef.current) {
          isCompleteRef.current = true;
          onComplete(testCase.id, [], err instanceof Error ? err.message : "Send failed");
        }
      });
    } else if (!isCompleteRef.current) {
      // All messages sent & all responses received → fetch once
      isCompleteRef.current = true;
      (async () => {
        const chatEndTime = Date.now(); // capture before wait+fetch so duration excludes thread API overhead
        await new Promise((r) => setTimeout(r, 1500)); // wait for server persistence
        const conversation = await fetchAllMessages();
        onComplete(testCase.id, conversation.length > 0 ? conversation : [], undefined, chatEndTime);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, tick]);

  // ---- Timeout ----
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isCompleteRef.current) {
        isCompleteRef.current = true;
        onComplete(testCase.id, [], "Test timed out (240s)", Date.now());
      }
    }, 240_000);
    return () => clearTimeout(timeout);
  }, [onComplete, testCase.id]);

  return (
    <div
      id={containerId}
      className="test-chatkit-container w-full h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 border-none"
    >
      <ChatKit control={chatkit.control} className="block h-full w-full" />
    </div>
  );
});

// ── Star Rating Component ──────────────────────────────────────────────

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(value === star ? 0 : star)}
          className={`p-1 rounded-md transition-all ${star <= value
            ? "text-yellow-500 fill-yellow-500 hover:text-yellow-400"
            : "text-slate-300 dark:text-slate-600 hover:text-yellow-500/50"
            }`}
          title={`${star} star${star > 1 ? "s" : ""}`}
        >
          <Star className={`w-4 h-4 ${star <= value ? 'fill-current' : ''}`} />
        </button>
      ))}
    </span>
  );
}

// ── Main Dev Test Page ─────────────────────────────────────────────────

function DevTestPageInner() {
  const { scheme } = useColorScheme();
  const { fontSize } = useFontSize();
  const baseFontSize = fontSize === "small" ? 14 : fontSize === "large" ? 18 : 16;

  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    ALL_DATASETS[0].id
  );
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(
    new Set()
  );
  const [results, setResults] = useState<TestResult[]>([]);
  const [runnerStatus, setRunnerStatus] = useState<RunnerStatus>("idle");
  const [currentTestIndex, setCurrentTestIndex] = useState(-1);
  const [sessionKeys, setSessionKeys] = useState<Record<string, number>>({});
  const [currentProgress, setCurrentProgress] = useState("");
  const [activePreviewTab, setActivePreviewTab] = useState<string>("");
  const [completedSessionIds, setCompletedSessionIds] = useState<Set<string>>(
    new Set()
  );
  const [customWorkflowId, setCustomWorkflowId] = useState<string>(
    WORKFLOW_PRESETS.length > 0 ? WORKFLOW_PRESETS[0].id : ""
  );
  const [showPreview, setShowPreview] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDatasetPreview, setShowDatasetPreview] = useState(false);
  const [editedDatasets, setEditedDatasets] = useState<Record<string, TestDataset>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [intakeData, setIntakeData] = useState<IntakeData>(DEFAULT_INTAKE_DATA);
  const [expandedTurns, setExpandedTurns] = useState<Set<string>>(new Set());
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const stopRequestedRef = useRef(false);
  const retryingIdsRef = useRef<Set<string>>(new Set());

  const effectiveWorkflowId = customWorkflowId.trim() || WORKFLOW_ID;

  const selectedDataset = useMemo(
    () =>
      ALL_DATASETS.find((d) => d.id === selectedDatasetId) || ALL_DATASETS[0],
    [selectedDatasetId]
  );

  const effectiveDataset = useMemo(
    () => editedDatasets[selectedDatasetId] || selectedDataset,
    [editedDatasets, selectedDatasetId, selectedDataset]
  );

  const testsToRun = useMemo(() => {
    if (selectedTestIds.size === 0) return effectiveDataset.testCases;
    return effectiveDataset.testCases.filter((tc) => selectedTestIds.has(tc.id));
  }, [effectiveDataset, selectedTestIds]);

  // ---- Toggle test selection ----
  const toggleTestSelection = useCallback((testId: string) => {
    setSelectedTestIds((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId);
      else next.add(testId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTestIds(new Set(effectiveDataset.testCases.map((tc) => tc.id)));
  }, [effectiveDataset]);

  const selectNone = useCallback(() => {
    setSelectedTestIds(new Set());
  }, []);

  // ---- Init results for a run ----
  const initResults = useCallback(() => {
    const initial: TestResult[] = testsToRun.map((tc) => ({
      testCaseId: tc.id,
      testCaseName: tc.name,
      status: "pending",
      conversation: [],
    }));
    setResults(initial);
    setCompletedSessionIds(new Set());
    // Generate session keys for all tests at once
    const keys: Record<string, number> = {};
    testsToRun.forEach((tc) => {
      keys[tc.id] = Date.now() + Math.random();
    });
    setSessionKeys(keys);
    return initial;
  }, [testsToRun]);

  // ---- Start run ----
  const startRun = useCallback(() => {
    stopRequestedRef.current = false;
    initResults();
    setRunnerStatus("running");
    setCurrentTestIndex(0);
    setActivePreviewTab("");
    setShowPreview(true);
  }, [initResults]);

  // ---- Stop run ----
  const stopRun = useCallback(() => {
    stopRequestedRef.current = true;
    setRunnerStatus("stopped");
    setCurrentTestIndex(-1);
  }, []);

  // ---- Handle test completion ----
  const handleTestComplete = useCallback(
    (testCaseId: string, conversation: ConversationTurn[], error?: string, chatEndTime?: number) => {
      setResults((prev) => {
        const next = [...prev];
        const idx = next.findIndex((r) => r.testCaseId === testCaseId);
        if (idx !== -1) {
          const endTs = chatEndTime ?? Date.now();
          next[idx] = {
            ...next[idx],
            status: error ? "error" : "success",
            conversation,
            error,
            endTime: endTs,
            duration: next[idx].startTime
              ? endTs - next[idx].startTime!
              : undefined,
          };
        }
        return next;
      });

      setCompletedSessionIds((prev) => new Set([...prev, testCaseId]));

      // If this was a retry, skip index advancement
      if (retryingIdsRef.current.has(testCaseId)) {
        retryingIdsRef.current.delete(testCaseId);
        return;
      }

      // Move to next test or complete
      setCurrentTestIndex((prevIdx) => {
        const nextIdx = prevIdx + 1;
        if (stopRequestedRef.current || nextIdx >= testsToRun.length) {
          setRunnerStatus(
            stopRequestedRef.current ? "stopped" : "completed"
          );
          return -1;
        }
        return nextIdx;
      });
    },
    [testsToRun.length]
  );

  // ---- Retry a single failed test case ----
  const handleRetry = useCallback((testCaseId: string) => {
    retryingIdsRef.current.add(testCaseId);
    setResults((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r.testCaseId === testCaseId);
      if (idx !== -1) {
        next[idx] = {
          ...next[idx],
          status: "running",
          conversation: [],
          error: undefined,
          startTime: Date.now(),
          endTime: undefined,
          duration: undefined,
        };
      }
      return next;
    });
    setSessionKeys((prev) => ({
      ...prev,
      [testCaseId]: Date.now() + Math.random(),
    }));
    setShowPreview(true);
    setActivePreviewTab(testCaseId);
  }, []);

  // ---- Handle progress ----
  const handleProgress = useCallback(
    (_testCaseId: string, msgIdx: number, total: number) => {
      setCurrentProgress(`message ${msgIdx + 1}/${total}`);
    },
    []
  );

  // ---- Mark current test as running when index changes ----
  useEffect(() => {
    if (currentTestIndex >= 0 && currentTestIndex < testsToRun.length) {
      const tc = testsToRun[currentTestIndex];
      setActivePreviewTab(tc.id);
      setResults((prev) => {
        const next = [...prev];
        const idx = next.findIndex((r) => r.testCaseId === tc.id);
        if (idx !== -1) {
          next[idx] = {
            ...next[idx],
            status: "running",
            startTime: Date.now(),
          };
        }
        return next;
      });
    }
  }, [currentTestIndex, testsToRun]);

  // ---- Update rating for a specific turn ----
  const updateTurnRating = useCallback(
    (testCaseId: string, turnIndex: number, rating: Partial<TurnRating>) => {
      setResults((prev) => {
        const next = [...prev];
        const rIdx = next.findIndex((r) => r.testCaseId === testCaseId);
        if (rIdx === -1) return prev;
        const conversation = [...next[rIdx].conversation];
        const turn = conversation[turnIndex];
        if (!turn) return prev;
        conversation[turnIndex] = {
          ...turn,
          rating: {
            stars: turn.rating?.stars ?? 0,
            hallucination: turn.rating?.hallucination ?? false,
            note: turn.rating?.note ?? "",
            ...rating,
          },
        };
        next[rIdx] = { ...next[rIdx], conversation };
        return next;
      });
    },
    []
  );

  // ---- Export JSON ----
  const exportJSON = useCallback(() => {
    const allRatings = results.flatMap((r) =>
      r.conversation
        .filter((t) => t.role === "assistant" && t.rating && t.rating.stars > 0)
        .map((t) => t.rating!.stars)
    );
    const globalAvgRating =
      allRatings.length > 0
        ? parseFloat(
          (
            allRatings.reduce((a, b) => a + b, 0) / allRatings.length
          ).toFixed(1)
        )
        : null;
    const globalHallCount = results.flatMap((r) =>
      r.conversation.filter(
        (t) => t.role === "assistant" && t.rating?.hallucination
      )
    ).length;

    const exportData = {
      dataset: effectiveDataset.name,
      workflowId: effectiveWorkflowId,
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: results.length,
        passed: results.filter((r) => r.status === "success").length,
        failed: results.filter((r) => r.status === "error").length,
        avgRating: globalAvgRating,
        hallucinationCount: globalHallCount,
      },
      results: results.map((r) => {
        const meta = computePerCaseMeta(r);
        return {
          testCase: r.testCaseName,
          testCaseId: r.testCaseId,
          status: r.status,
          duration: r.duration ? formatDuration(r.duration) : null,
          error: r.error || null,
          meta: {
            avgRating: meta.avgRating,
            hallucinationCount: meta.hallucinationCount,
            widgetCount: meta.widgetCount,
            totalTurns: meta.totalTurns,
            assistantTurns: meta.assistantTurnsCount,
          },
          conversation: r.conversation.map((t) => ({
            role: t.role,
            content: t.content,
            timestamp: new Date(t.timestamp).toISOString(),
            isWidget: t.isWidget || false,
            ...(t.role === "assistant" && t.rating
              ? {
                rating: {
                  stars: t.rating.stars,
                  hallucination: t.rating.hallucination,
                  note: t.rating.note || undefined,
                },
              }
              : {}),
          })),
        };
      }),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-results-${effectiveDataset.id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [results, effectiveDataset, effectiveWorkflowId]);

  // ---- Export CSV ----
  const exportCSV = useCallback(() => {
    const allRatings = results.flatMap((r) =>
      r.conversation
        .filter((t) => t.role === "assistant" && t.rating && t.rating.stars > 0)
        .map((t) => t.rating!.stars)
    );
    const avgRating =
      allRatings.length > 0
        ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
        : "N/A";
    const hallCount = results.flatMap((r) =>
      r.conversation.filter(
        (t) => t.role === "assistant" && t.rating?.hallucination
      )
    ).length;

    const metaLines = [
      `# Test Results Export`,
      `# Dataset: ${effectiveDataset.name}`,
      `# Workflow ID: ${effectiveWorkflowId}`,
      `# Timestamp: ${new Date().toISOString()}`,
      `# Total Tests: ${results.length}`,
      `# Passed: ${results.filter((r) => r.status === "success").length}`,
      `# Failed: ${results.filter((r) => r.status === "error").length}`,
      `# Average Rating (global): ${avgRating} / 5.0`,
      `# Hallucinations Flagged (global): ${hallCount}`,
      `#`,
    ];

    const escapeCSV = (s: string) =>
      `"${s.replace(/"/g, '""').replace(/\n/g, "\\n")}"`;
    const header =
      "Test Case,Test Case ID,Status,Duration,Case Avg Rating,Case Hallucinations,Turn #,Role,Content,Is Widget,Rating (Stars),Hallucination,Note";
    const rows: string[] = [];

    results.forEach((r) => {
      const caseMeta = computePerCaseMeta(r);
      const caseAvg = caseMeta.avgRating !== null ? String(caseMeta.avgRating) : "";
      const caseHall = String(caseMeta.hallucinationCount);

      if (r.conversation.length === 0) {
        rows.push(
          [
            escapeCSV(r.testCaseName),
            escapeCSV(r.testCaseId),
            r.status,
            r.duration ? formatDuration(r.duration) : "",
            caseAvg,
            caseHall,
            "", "", "", "", "", "", "",
          ].join(",")
        );
      } else {
        r.conversation.forEach((t, i) => {
          rows.push(
            [
              escapeCSV(r.testCaseName),
              escapeCSV(r.testCaseId),
              r.status,
              r.duration ? formatDuration(r.duration) : "",
              caseAvg,
              caseHall,
              String(i + 1),
              t.role,
              escapeCSV(t.content),
              t.isWidget ? "Yes" : "No",
              t.rating?.stars || "",
              t.rating?.hallucination ? "Yes" : "No",
              escapeCSV(t.rating?.note || ""),
            ].join(",")
          );
        });
      }
    });

    const csv = [...metaLines, header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-results-${effectiveDataset.id}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [results, effectiveDataset, effectiveWorkflowId]);

  // ---- Close export menu on click outside ----
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  // ---- Save to Database ----
  const saveToDatabase = useCallback(async () => {
    setSaveStatus("saving");
    setShowExportMenu(false);

    const allRatings = results.flatMap((r) =>
      r.conversation
        .filter((t) => t.role === "assistant" && t.rating && t.rating.stars > 0)
        .map((t) => t.rating!.stars)
    );
    const globalAvgRating =
      allRatings.length > 0
        ? parseFloat(
          (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
        )
        : null;
    const globalHallCount = results.flatMap((r) =>
      r.conversation.filter(
        (t) => t.role === "assistant" && t.rating?.hallucination
      )
    ).length;
    const globalWidgetCount = results.flatMap((r) =>
      r.conversation.filter((t) => t.isWidget)
    ).length;

    const presetName =
      WORKFLOW_PRESETS.find((p) => p.id === effectiveWorkflowId)?.name ||
      null;

    const payload = {
      dataset_name: effectiveDataset.name,
      dataset_id: effectiveDataset.id,
      workflow_id: effectiveWorkflowId,
      workflow_name: presetName,
      total_tests: results.length,
      passed_tests: results.filter((r) => r.status === "success").length,
      failed_tests: results.filter((r) => r.status === "error").length,
      avg_rating: globalAvgRating,
      hallucination_count: globalHallCount,
      widget_count: globalWidgetCount,
      results: results.map((r) => {
        const meta = computePerCaseMeta(r);
        return {
          testCaseId: r.testCaseId,
          testCaseName: r.testCaseName,
          status: r.status,
          duration: r.duration ?? null,
          error: r.error ?? null,
          meta,
          conversation: r.conversation,
        };
      }),
    };

    try {
      const res = await fetch("/api/dev-test-history", {
        method: "POST",
        headers: devAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("[saveToDatabase]", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  }, [results, effectiveDataset, effectiveWorkflowId]);

  // ---- Download dataset ----
  const downloadDataset = useCallback(() => {
    const blob = new Blob([JSON.stringify(selectedDataset, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataset-${selectedDataset.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedDataset]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = results.length;
    const completed = results.filter(
      (r) => r.status === "success" || r.status === "error"
    ).length;
    const success = results.filter((r) => r.status === "success").length;
    const errors = results.filter((r) => r.status === "error").length;
    return { total, completed, success, errors };
  }, [results]);

  // Active preview tabs = currently running + all completed
  const previewTabs = useMemo(() => {
    return testsToRun.filter(
      (tc) =>
        completedSessionIds.has(tc.id) ||
        (currentTestIndex >= 0 && testsToRun[currentTestIndex]?.id === tc.id)
    );
  }, [testsToRun, completedSessionIds, currentTestIndex]);

  // ── Render ──

  return (
    <div className="mx-auto w-[95%] min-w-[1440px] flex flex-col gap-4 flex-1 min-h-0 overflow-x-auto overflow-y-auto pt-4 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 shadow-md">
              <FlaskConical className="w-5 h-5" />
            </div>
            Chat Session Test Runner
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automated conversation testing — each test case gets
            an independent session
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/trial-chat/dev-test/history"
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 shadow-md rounded-full px-3 py-1.5 border border-slate-200 dark:border-slate-700/50 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            History
          </Link>
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-slate-500 bg-white dark:bg-slate-800 shadow-md rounded-full px-3 py-1.5 border border-slate-200 dark:border-slate-700/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            DEV MODE
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-1 min-h-0 gap-4">

        {/* Left Column: Controls + Progress + Test Cases */}
        <div className="w-1/2 shrink-0 flex flex-col gap-4 min-h-0">

          {/* Workflow ID + Controls Bar */}
          <div className="flex flex-col gap-3 p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
            {/* Row 1: Workflow */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-500 dark:text-slate-400 font-medium shrink-0">
                Workflow:
              </label>
              {WORKFLOW_PRESETS.length > 0 && (
                <select
                  value={
                    WORKFLOW_PRESETS.find((p) => p.id === customWorkflowId)?.id ??
                    "__custom__"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomWorkflowId(val === "__custom__" ? "" : val);
                  }}
                  disabled={runnerStatus === "running"}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg h-8 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {WORKFLOW_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="__custom__">
                    {WORKFLOW_ID ? "Default (.env)" : "Custom…"}
                  </option>
                </select>
              )}
              <input
                type="text"
                value={customWorkflowId}
                onChange={(e) => setCustomWorkflowId(e.target.value)}
                placeholder={WORKFLOW_ID || "Paste workflow ID here…"}
                disabled={runnerStatus === "running"}
                className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg h-8 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
              {customWorkflowId && (
                <button
                  onClick={() => setCustomWorkflowId("")}
                  className="text-xs text-blue-400 hover:text-blue-500 disabled:opacity-50 transition-colors"
                  title="Reset to default"
                >
                  ✕ Reset
                </button>
              )}
            </div>

            {/* Row 2: Dataset + Selection + Actions */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Dataset Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Dataset:
                </label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => {
                    setSelectedDatasetId(e.target.value);
                    setSelectedTestIds(new Set());
                    setResults([]);
                    setRunnerStatus("idle");
                    setCompletedSessionIds(new Set());
                  }}
                  disabled={runnerStatus === "running"}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg h-8 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {ALL_DATASETS.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.testCases.length} tests)
                    </option>
                  ))}
                </select>
                <button
                  onClick={downloadDataset}
                  className="text-xs text-blue-400 hover:text-blue-500 disabled:opacity-50 transition-colors flex items-center gap-1.5 ml-2"
                  title="Download dataset JSON"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  onClick={() => setShowDatasetPreview(true)}
                  className="text-xs text-blue-400 hover:text-blue-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  title="Preview & edit dataset"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
              </div>

              <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />

              {/* Select All / Clear */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={selectAll}
                  disabled={runnerStatus === "running" || selectedTestIds.size === effectiveDataset.testCases.length}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Select All
                </button>
                <span className="text-slate-400 dark:text-slate-600">|</span>
                <button
                  onClick={selectNone}
                  disabled={runnerStatus === "running" || selectedTestIds.size === 0}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center gap-1"
                >
                  <MinusSquare className="w-3.5 h-3.5" /> Clear
                </button>
                <span className="text-slate-500 ml-1">
                  ({selectedTestIds.size} / {effectiveDataset.testCases.length} checked)
                </span>
              </div>
            </div>

            {/* Row 3: Intake Settings */}
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-500 dark:text-slate-400 font-medium shrink-0">
                    Intake:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={intakeData.role ?? ''}
                      onChange={(e) => setIntakeData((prev) => ({ ...prev, role: (e.target.value || null) as IntakeData["role"] }))}
                      disabled={runnerStatus === "running"}
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg h-8 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="user">Patient</option>
                      <option value="caregiver">Caregiver</option>
                    </select>
                    <select
                      value={intakeData.response_style ?? ''}
                      onChange={(e) => setIntakeData((prev) => ({ ...prev, response_style: (e.target.value || null) as IntakeData["response_style"] }))}
                      disabled={runnerStatus === "running"}
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg h-8 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="concise">Concise</option>
                      <option value="balanced">Balanced</option>
                      <option value="verbose">Verbose</option>
                    </select>
                    <select
                      value={intakeData.intent ?? ''}
                      onChange={(e) => setIntakeData((prev) => ({ ...prev, intent: (e.target.value || null) as IntakeData["intent"] }))}
                      disabled={runnerStatus === "running"}
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg h-8 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="trial_matching">Trial Matching</option>
                      <option value="learn_about_trials">Learn About Trials</option>
                    </select>
                    <button
                      onClick={() => setIntakeData(DEFAULT_INTAKE_DATA)}
                      disabled={runnerStatus === "running"}
                      className="text-xs text-blue-400 hover:text-blue-500 disabled:opacity-50 transition-colors px-1"
                      title="Reset to defaults"
                    >
                      ✕ Reset
                    </button>
                  </div>
                </div>
                {/* Run / Stop */}
                {runnerStatus === "running" ? (
                  <button
                    onClick={stopRun}
                    className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 h-9 px-4 rounded-lg text-sm font-semibold transition-all shadow-sm"
                  >
                    <Square className="w-4 h-4 fill-current" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={startRun}
                    disabled={!effectiveWorkflowId}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white h-9 px-4 rounded-lg text-sm font-semibold transition-all shadow-sm"
                  >
                    <Play className="w-4 h-4 fill-current" /> Run{" "}
                    {selectedTestIds.size > 0
                      ? `Selected (${selectedTestIds.size})`
                      : `All (${effectiveDataset.testCases.length})`}
                  </button>
                )}
              </div>

          </div>

          {/* Progress Bar */}
          {runnerStatus !== "idle" && (
            <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 shrink-0">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {runnerStatus === "running"
                    ? `Running test ${stats.completed + 1}/${stats.total}…`
                    : runnerStatus === "completed"
                      ? "All tests completed"
                      : "Tests stopped"}
                  {currentProgress && runnerStatus === "running" && (
                    <span className="text-slate-500 ml-2">
                      ({currentProgress})
                    </span>
                  )}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {stats.success} passed · {stats.errors} failed ·{" "}
                  {stats.total - stats.completed} remaining
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${stats.errors > 0 ? "bg-yellow-500" : "bg-green-500"
                    }`}
                  style={{
                    width: `${stats.total ? (stats.completed / stats.total) * 100 : 0
                      }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Test Case List */}
          <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="px-4 h-12 bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Test Cases
              </h2>
              <span className="text-xs text-slate-500">
                {effectiveDataset.description}
              </span>
            </div>
            <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {effectiveDataset.testCases.map((tc, idx) => {
                const result = results.find((r) => r.testCaseId === tc.id);
                const isChecked = selectedTestIds.has(tc.id);
                const isActive = activePreviewTab === tc.id;
                const isCurrent =
                  runnerStatus === "running" &&
                  currentTestIndex >= 0 &&
                  testsToRun[currentTestIndex]?.id === tc.id;

                return (
                  <div
                    key={tc.id}
                    onClick={() => setActivePreviewTab(tc.id)}
                    className={`px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${isActive
                      ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-2 border-l-blue-500"
                      : isCurrent
                        ? "bg-yellow-50/50 dark:bg-yellow-950/20 border-l-2 border-l-yellow-500"
                        : "hover:bg-slate-100/50 dark:hover:bg-slate-800/50 border-l-2 border-l-transparent"
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => { e.stopPropagation(); toggleTestSelection(tc.id); }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={runnerStatus === "running"}
                      className="rounded bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                          {idx + 1}. {tc.name}
                        </span>
                        <span className="text-xs text-slate-500 shrink-0">
                          {tc.messages.length} msgs
                        </span>
                      </div>
                      {tc.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {tc.description}
                        </p>
                      )}
                    </div>
                    {result && (
                      <span className="flex items-center shrink-0 gap-1.5" title={result.error}>
                        {statusIcon(result.status)}
                        {result.duration && (
                          <span className="text-xs text-slate-500 ml-1">
                            {formatDuration(result.duration)}
                          </span>
                        )}
                        {result.status === "error" && runnerStatus !== "running" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRetry(tc.id); }}
                            title="Retry this test case"
                            className="p-1 rounded-md text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>{/* end Left Column */}

        {/* Right Column: Conversation Logs + Live Preview */}
        <div className="flex-1 flex gap-4 min-h-0">

          {/* Conversation Logs */}
          <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="px-4 h-12 bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                📋 Conversation Logs
              </h2>
              <div className="flex items-center gap-2">
                {saveStatus !== "idle" && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${saveStatus === "saving" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10" :
                    saveStatus === "saved" ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" :
                      "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10"
                    }`}>
                    {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : "✕ Save failed"}
                  </span>
                )}
                {results.some(
                  (r) => r.status === "success" || r.status === "error"
                ) && (
                    <div className="relative" ref={exportMenuRef}>
                      <button
                        onClick={() => setShowExportMenu((v) => !v)}
                        className="text-xs flex items-center gap-1.5 h-8 px-3 rounded-lg transition-all font-medium border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
                      </button>
                      {showExportMenu && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 py-1">
                          <button
                            onClick={exportJSON}
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-blue-500" /> Export as JSON
                          </button>
                          <button
                            onClick={exportCSV}
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-500" /> Export as CSV
                          </button>
                          <div className="my-1 border-t border-slate-100 dark:border-slate-700/50" />
                          <button
                            onClick={saveToDatabase}
                            disabled={saveStatus === "saving"}
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors disabled:opacity-50"
                          >
                            <Database className="w-3.5 h-3.5 text-purple-500" />
                            {saveStatus === "saving" ? "Saving…" : "Save to Database"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                <button
                  onClick={() => setShowPreview((v) => !v)}
                  className={`text-xs flex items-center gap-1.5 h-8 px-3 rounded-lg transition-all font-medium border shadow-sm ${showPreview
                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                >
                  {showPreview ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
                  Preview
                </button>
              </div>
            </div>

            {/* Tab bar for conversation logs */}
            {results.length > 0 && (
              <div className="flex items-center border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0">
                {results.map((r) => {
                  const isActive = activePreviewTab === r.testCaseId;
                  return (
                    <button
                      key={r.testCaseId}
                      onClick={() => setActivePreviewTab(r.testCaseId)}
                      className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${isActive
                        ? "border-blue-500 text-blue-600 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20"
                        : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                    >
                      <span className="flex items-center justify-center w-4 h-4">{statusIcon(r.status)}</span>
                      {r.testCaseName}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700/50">
                    <FlaskConical className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Click Run to start testing</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1.5">
                    Each test case creates a new ChatKit session
                  </p>
                </div>
              ) : (
                results.map((result) => (
                  <div
                    key={result.testCaseId}
                    style={{ display: activePreviewTab === result.testCaseId ? "block" : "none" }}
                  >
                    {/* Status header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center justify-center">{statusIcon(result.status)}</span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {result.testCaseName}
                      </span>
                      {result.status === "running" && (
                        <span className="text-xs text-blue-400 animate-pulse">Generating...</span>
                      )}
                      {result.error && (
                        <span className="text-xs text-red-400 truncate max-w-[200px]">{result.error}</span>
                      )}
                      {result.duration && (
                        <span className="text-xs text-slate-500">{formatDuration(result.duration)}</span>
                      )}
                      {result.status === "error" && runnerStatus !== "running" && (
                        <button
                          onClick={() => handleRetry(result.testCaseId)}
                          className="ml-auto flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry
                        </button>
                      )}
                    </div>

                    {/* Conversation turns */}
                    {result.conversation.length > 0 ? (
                      <div className="space-y-3">
                        {result.conversation.map((turn, i) => {
                          const rating = turn.rating || { stars: 0, hallucination: false, note: "" };
                          const turnKey = `${result.testCaseId}-${i}`;
                          const isAssistant = turn.role === "assistant";
                          const isLong = isAssistant && (turn.content.length > 250 || (turn.content.match(/\n/g) || []).length >= 3);
                          const isExpanded = expandedTurns.has(turnKey);
                          const toggleExpand = () => setExpandedTurns((prev) => {
                            const next = new Set(prev);
                            if (next.has(turnKey)) next.delete(turnKey); else next.add(turnKey);
                            return next;
                          });
                          return (
                            <div key={i} className="flex flex-col gap-1">
                              <div className="flex gap-3">
                                <span className={`text-[11px] font-semibold tracking-wide px-2 py-1.5 rounded-md shrink-0 h-fit mt-0.5 w-[52px] text-center ${turn.role === "user" ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  }`}>
                                  {turn.role === "user" ? "USER" : "AI"}
                                </span>
                                <div className={`text-sm leading-relaxed whitespace-pre-wrap break-words min-w-0 flex-1 px-3 py-2 rounded-xl ${turn.role === "user" ? "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50" : "text-slate-800 dark:text-slate-200"
                                  }`}>
                                  <div className={isAssistant && isLong && !isExpanded ? "line-clamp-3" : ""}>
                                    {turn.content}
                                  </div>
                                  {isLong && (
                                    <button
                                      onClick={toggleExpand}
                                      className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-400 transition-colors"
                                    >
                                      <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                      {isExpanded ? "Collapse" : "Expand"}
                                    </button>
                                  )}
                                </div>
                                {turn.isWidget && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 shrink-0 self-start mt-1.5 tracking-wide">
                                    WIDGET
                                  </span>
                                )}
                              </div>
                              {turn.role === "assistant" && (
                                <div className="ml-12 flex items-center gap-4 mt-1">
                                  <StarRating value={rating.stars} onChange={(stars) => updateTurnRating(result.testCaseId, i, { stars })} />
                                  <label className="flex items-center gap-1.5 text-xs cursor-pointer group">
                                    <input type="checkbox" checked={rating.hallucination} onChange={(e) => updateTurnRating(result.testCaseId, i, { hallucination: e.target.checked })} className="rounded-sm bg-slate-700 border-slate-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 w-3.5 h-3.5" />
                                    <span className="text-orange-500/70 group-hover:text-orange-500 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Hallucination</span>
                                  </label>
                                  <input type="text" placeholder="Note..." value={rating.note} onChange={(e) => updateTurnRating(result.testCaseId, i, { note: e.target.value })} className="bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 w-40 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 py-4 text-center">
                        {result.status === "pending" ? "Waiting to run..." : result.status === "running" ? "Conversation in progress..." : "No conversation data"}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Preview */}
          <div className={`${showPreview ? "w-1/2 flex" : "hidden"} flex-col bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm shrink-0 overflow-hidden`}>
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-4 h-12 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-800/80">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <PanelRightOpen className="w-4 h-4 text-blue-500" />
                Live Preview
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:text-slate-200 dark:hover:bg-slate-800/50 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sidebar Tab Bar */}
            {previewTabs.length > 0 ? (
              <>
                <div className="flex items-center border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0">
                  {previewTabs.map((tc) => {
                    const result = results.find((r) => r.testCaseId === tc.id);
                    const isActive = activePreviewTab === tc.id;
                    return (
                      <button
                        key={tc.id}
                        onClick={() => setActivePreviewTab(tc.id)}
                        className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${isActive
                          ? "border-blue-500 text-blue-600 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20"
                          : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          }`}
                      >
                        <span className="flex items-center justify-center w-4 h-4">{result ? statusIcon(result.status) : <Clock className="w-3.5 h-3.5 text-slate-400" />}</span>
                        {tc.name}
                      </button>
                    );
                  })}
                </div>

                {/* Session Panels */}
                <div className="flex-1 min-h-0 relative">
                  {previewTabs.map((tc) => {
                    const isActive = activePreviewTab === tc.id;
                    const isRunning = runnerStatus === "running" && currentTestIndex >= 0 && testsToRun[currentTestIndex]?.id === tc.id;
                    const isCompleted = completedSessionIds.has(tc.id);
                    return (
                      <div key={tc.id} style={{ display: isActive ? "block" : "none" }} className="h-full">
                        {(isRunning || isCompleted) && (
                          <TestSession
                            key={sessionKeys[tc.id]}
                            testCase={tc}
                            workflowId={effectiveWorkflowId}
                            containerId={`chatkit-session-${tc.id}`}
                            colorScheme={scheme}
                            baseFontSize={baseFontSize as 14 | 16 | 18}
                            intakeData={intakeData}
                            onComplete={handleTestComplete}
                            onProgress={handleProgress}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-800/80">
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No active sessions</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1.5 text-center max-w-[200px]">
                  Select a test case and click Run to start testing and see the live preview here.
                </p>
              </div>
            )}
          </div>
        </div>{/* end Right Column */}
      </div>

      {/* Dataset Preview Modal */}
      {showDatasetPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowDatasetPreview(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-[90vw] max-w-4xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-500" />
                  Dataset Preview
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {effectiveDataset.name} \u2014 {effectiveDataset.testCases.length} test cases
                  {editedDatasets[selectedDatasetId] && (
                    <span className="ml-2 text-amber-500 font-medium">\u25CF Unsaved edits (in-memory only)</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {editedDatasets[selectedDatasetId] && (
                  <button
                    onClick={() => {
                      setEditedDatasets((prev) => {
                        const next = { ...prev };
                        delete next[selectedDatasetId];
                        return next;
                      });
                    }}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 font-medium transition-colors"
                  >
                    Reset Edits
                  </button>
                )}
                <button
                  onClick={() => setShowDatasetPreview(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Table */}
            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
              <table className="w-full text-sm min-w-[1000px] table-fixed">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 backdrop-blur-sm z-10">
                  <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3 w-12 whitespace-nowrap">#</th>
                    <th className="px-4 py-3 w-[200px] whitespace-nowrap">Name</th>
                    <th className="px-4 py-3 w-[300px] whitespace-nowrap">Description</th>
                    <th className="px-4 py-3 whitespace-nowrap">Messages</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {effectiveDataset.testCases.map((tc, idx) => (
                    <tr
                      key={tc.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors align-top whitespace-nowrap"
                    >
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={tc.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setEditedDatasets((prev) => {
                              const base =
                                prev[selectedDatasetId] ||
                                JSON.parse(JSON.stringify(selectedDataset));
                              const testCases = base.testCases.map(
                                (t: TestCase) =>
                                  t.id === tc.id ? { ...t, name: newName } : t
                              );
                              return {
                                ...prev,
                                [selectedDatasetId]: { ...base, testCases },
                              };
                            });
                          }}
                          className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 rounded px-2 py-1 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={tc.description || ""}
                          onChange={(e) => {
                            const newDesc = e.target.value;
                            setEditedDatasets((prev) => {
                              const base =
                                prev[selectedDatasetId] ||
                                JSON.parse(JSON.stringify(selectedDataset));
                              const testCases = base.testCases.map(
                                (t: TestCase) =>
                                  t.id === tc.id
                                    ? { ...t, description: newDesc }
                                    : t
                              );
                              return {
                                ...prev,
                                [selectedDatasetId]: { ...base, testCases },
                              };
                            });
                          }}
                          className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 rounded px-2 py-1 text-sm text-slate-500 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          {tc.messages.map((msg, mi) => (
                            <div key={mi} className="flex items-start gap-2">
                              <span className="text-[10px] font-mono text-slate-400 mt-1.5 shrink-0 w-4 text-right">
                                {mi + 1}.
                              </span>
                              <input
                                type="text"
                                value={msg}
                                onChange={(e) => {
                                  const newMsg = e.target.value;
                                  setEditedDatasets((prev) => {
                                    const base =
                                      prev[selectedDatasetId] ||
                                      JSON.parse(
                                        JSON.stringify(selectedDataset)
                                      );
                                    const testCases = base.testCases.map(
                                      (t: TestCase) => {
                                        if (t.id !== tc.id) return t;
                                        const messages = [...t.messages];
                                        messages[mi] = newMsg;
                                        return { ...t, messages };
                                      }
                                    );
                                    return {
                                      ...prev,
                                      [selectedDatasetId]: {
                                        ...base,
                                        testCases,
                                      },
                                    };
                                  });
                                }}
                                className="flex-1 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 rounded px-2 py-1 text-sm text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-xs text-slate-500">
                Edits are stored in browser memory only \u2014 they will reset on
                page refresh.
              </span>
              <button
                onClick={() => setShowDatasetPreview(false)}
                className="text-xs font-medium px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-slate-600 shrink-0 py-1">
        Session Test Runner · Workflow:{" "}
        <span className="text-slate-500 font-mono">
          {effectiveWorkflowId
            ? effectiveWorkflowId.length > 30
              ? effectiveWorkflowId.slice(0, 30) + "…"
              : effectiveWorkflowId
            : "Not configured"}
        </span>
      </div>
    </div>
  );
}

export default function DevTestPage() {
  return (
    <DevGate>
      <DevTestPageInner />
    </DevGate>
  );
}
