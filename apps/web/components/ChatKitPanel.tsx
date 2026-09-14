"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  PLACEHOLDER_INPUT,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  getThemeConfig,
  getStarterPromptsForUser,
  getGreetingForUser,
} from "@/lib/config";
import { resolvePrompts } from "@/lib/types/prompts";
import { IntakeData } from "@/lib/types/intake";
import { ErrorOverlay } from "./ErrorOverlay";
import { VoiceInputButton } from "./VoiceInputButton";
import { VoiceInputButtonWhisper } from "./VoiceInputButtonWhisper";
import type { ColorScheme } from "@/hooks/useColorScheme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useFontSize } from "@/contexts/FontSizeContext";
import { useVoiceInputMode } from "@/contexts/VoiceInputModeContext";
import { correctMedicalTerms } from "@/lib/medicalTermsCorrection";
import { createLogger } from "@/lib/logger";
import { getOrCreateGuestUserId, isTestMode } from "@/lib/guestId";
import { MatchProfileModal } from "./MatchProfileModal";
import type { MatchProfile } from "./MatchProfileModal";
import { ClinicianModal } from "./ClinicianModal";

export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
};

type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: (action: FactAction) => Promise<void>;
  onResponseEnd: () => void;
  onThemeRequest: (scheme: ColorScheme) => void;
  onOpenResourcePanel: () => void;
  autoOpenMatch?: boolean;
};

type ErrorState = {
  script: string | null;
  session: string | null;
  integration: string | null;
  retryable: boolean;
};

const isBrowser = typeof window !== "undefined";
const isDev =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_DEBUG === "true";
const log = createLogger("ChatKitPanel");

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

// Voice Input Button Switcher - switches between Web Speech and Whisper based on context mode
function VoiceInputButtonSwitcher({ 
  onTranscript, 
  className 
}: { 
  onTranscript: (text: string) => void; 
  className?: string;
}) {
  const { mode } = useVoiceInputMode();
  
  if (mode === "whisper") {
    return <VoiceInputButtonWhisper onTranscript={onTranscript} className={className} />;
  }
  
  return <VoiceInputButton onTranscript={onTranscript} className={className} />;
}

export function ChatKitPanel({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
  onOpenResourcePanel,
  autoOpenMatch = false,
}: ChatKitPanelProps) {
  // Sign-in is not supported; all users are treated as guests.
  const isSignedIn = false;
  const { fontSize } = useFontSize();
  const processedFacts = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const [isContentReady, setIsContentReady] = useState(false); // True after chatkit.thread.load.end fires
  const [isOverlayFadingOut, setIsOverlayFadingOut] = useState(false); // Triggers CSS fade before DOM removal
  const [intakeData, setIntakeData] = useState<IntakeData | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showClinicianModal, setShowClinicianModal] = useState(false);
  const isMountedRef = useRef(true);
  const markContentReadyRef = useRef<((extraDelay?: number) => void) | null>(null);
  const [scriptStatus, setScriptStatus] = useState<
    "pending" | "ready" | "error"
  >(() =>
    isBrowser && window.customElements?.get("openai-chatkit")
      ? "ready"
      : "pending"
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load intake data from localStorage on component mount
  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const stored = localStorage.getItem('intake_data');
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        log('Loaded intake data on mount:', parsedData);
        setIntakeData(parsedData);
      } catch (error) {
        console.error('[ChatKitPanel] Failed to parse intake data on mount:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    let timeoutId: number | undefined;

    const handleLoaded = () => {
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("ready");
      setErrorState({ script: null });
    };

    const handleError = (event: Event) => {
      console.error("Failed to load chatkit.js for some reason", event);
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("error");
      const detail = (event as CustomEvent<unknown>)?.detail ?? "unknown error";
      setErrorState({ script: `Error: ${detail}`, retryable: false });
      setIsInitializingSession(false);
    };

    window.addEventListener("chatkit-script-loaded", handleLoaded);
    window.addEventListener(
      "chatkit-script-error",
      handleError as EventListener
    );

    if (window.customElements?.get("openai-chatkit")) {
      handleLoaded();
    } else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!window.customElements?.get("openai-chatkit")) {
          handleError(
            new CustomEvent("chatkit-script-error", {
              detail:
                "ChatKit web component is unavailable. Verify that the script URL is reachable.",
            })
          );
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("chatkit-script-loaded", handleLoaded);
      window.removeEventListener(
        "chatkit-script-error",
        handleError as EventListener
      );
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [scriptStatus, setErrorState]);

  const isWorkflowConfigured = Boolean(
    WORKFLOW_ID && !WORKFLOW_ID.startsWith("wf_replace")
  );

  useEffect(() => {
    if (!isWorkflowConfigured && isMountedRef.current) {
      setErrorState({
        session: "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.",
        retryable: false,
      });
      setIsInitializingSession(false);
    }
  }, [isWorkflowConfigured, setErrorState]);

  const handleResetChat = useCallback(() => {
    processedFacts.current.clear();
    if (isBrowser) {
      setScriptStatus(
        window.customElements?.get("openai-chatkit") ? "ready" : "pending"
      );
    }
    setIsInitializingSession(true);
    setIsContentReady(false);
    setIsOverlayFadingOut(false);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
  }, []);

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      if (isDev) {
        console.info("[ChatKitPanel] getClientSecret invoked", {
          currentSecretPresent: Boolean(currentSecret),
          workflowId: WORKFLOW_ID,
          endpoint: CREATE_SESSION_ENDPOINT,
        });
      }

      if (!isWorkflowConfigured) {
        const detail =
          "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
          setIsInitializingSession(false);
        }
        throw new Error(detail);
      }

      if (isMountedRef.current) {
        if (!currentSecret) {
          setIsInitializingSession(true);
        }
        setErrorState({ session: null, integration: null, retryable: false });
      }

      try {
        // Read intake data from localStorage
        let parsedIntakeData = null;
        if (isBrowser) {
          const stored = localStorage.getItem('intake_data');
          log('Raw localStorage:', stored);
          if (stored) {
            try {
              parsedIntakeData = JSON.parse(stored);
              log('Parsed intake data:', parsedIntakeData);
              // Store in component state for use in startScreen configuration
              if (isMountedRef.current) {
                setIntakeData(parsedIntakeData);
              }
            } catch (error) {
              console.error('[ChatKitPanel] Failed to parse intake data:', error);
            }
          } else {
            log('No intake data in localStorage');
          }
        }

        // For guest users, maintain stable user ID to preserve chat history.
        // In test mode (?test=true), the id gets a `test_` prefix instead of
        // `guest_` so test conversations can be distinguished/excluded later.
        let guestUserId = null;
        if (isBrowser && !isSignedIn) {
          guestUserId = getOrCreateGuestUserId();
          log('Using guest ID:', guestUserId, isTestMode() ? '(test mode)' : '');
        }

        const requestBody = {
          workflow: { id: WORKFLOW_ID },
          intake_data: parsedIntakeData, // Pass to backend for processing
          guest_user_id: guestUserId, // Pass stable guest ID to preserve history
          is_test: isBrowser ? isTestMode() : false,
        };
        
        log('Sending to /api/create-session:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(CREATE_SESSION_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        const raw = await response.text();
        log("createSession raw body:", raw);

        if (isDev) {
          console.info("[ChatKitPanel] createSession response", {
            status: response.status,
            ok: response.ok,
            bodyPreview: raw.slice(0, 1600),
          });
        }

        // createSession response = ChatKit is about to render — start fade-out
        markContentReadyRef.current?.();

        let data: Record<string, unknown> = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch (parseError) {
            console.error(
              "Failed to parse create-session response",
              parseError
            );
          }
        }

        if (!response.ok) {
          const detail = extractErrorDetail(data, response.statusText);
          console.error("Create session request failed", {
            status: response.status,
            body: data,
          });
          throw new Error(detail);
        }

        const clientSecret = data?.client_secret as string | undefined;
        if (!clientSecret) {
          throw new Error("Missing client secret in response");
        }

        if (isMountedRef.current) {
          setErrorState({ session: null, integration: null });
        }

        return clientSecret;
      } catch (error) {
        console.error("Failed to create ChatKit session", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Unable to start ChatKit session.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
        }
        throw error instanceof Error ? error : new Error(detail);
      } finally {
        log("getClientSecret completed", { isMounted: isMountedRef.current, currentSecret });
        if (isMountedRef.current && !currentSecret) {
          // Do not force isInitializingSession to false here.
          // We wait for chatkit.control/session to be available in the useEffect hook.
          // This ensures the Voice button doesn't appear before the Chat UI is ready.
          log("Waiting for chatkit.control before setting isInitializingSession to false");
        } else {
             // For renewals (currentSecret present), we might not want to touch generic loading state
             // but if we were loading, this logic would apply.
             // However, !currentSecret covers the initial load case.
        }
      }
    },
    [isSignedIn, isWorkflowConfigured, setErrorState]
  );

  const baseSize = fontSize === "small" ? 14 : fontSize === "large" ? 18 : 16;
  
  const isMobile = useIsMobile();

  // Get dynamic greeting and prompts based on intake data
  const greeting = getGreetingForUser(intakeData);
  const prompts = resolvePrompts(getStarterPromptsForUser(intakeData), isMobile);
  
  log('Configuration:', {
    intakeData,
    greeting,
    promptsCount: prompts.length,
    firstPrompt: prompts[0]?.label,
  });
  
  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: theme,
      ...getThemeConfig(theme, baseSize),
    },
    startScreen: {
      greeting,
      prompts,
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
    },
    threadItemActions: {
      feedback: true,  // 启用反馈按钮（👍👎）
      retry: true,     // 启用重试按钮（🔄）
    },
    widgets: {
      onAction: async (action: { type: string; payload?: { text?: string }; [key: string]: unknown }) => {
        if (isDev) {
          console.info("[ChatKitPanel] widget action received:", action);
        }

        // Handle conversation.followup — auto-send the payload text
        if (action.type === "conversation.followup") {
          log("conversation.followup action:", action);
          const text = action.payload?.text;
          if (text && chatkit.control) {
            // Defer to next tick to avoid "Maximum update depth exceeded" (React #185)
            // caused by sendUserMessage triggering state updates during widget render
            setTimeout(async () => {
              try {
                await chatkit.sendUserMessage({ text });
                if (isDev) {
                  console.debug("[ChatKitPanel] conversation.followup sent:", text);
                }
              } catch (err) {
                console.error("[ChatKitPanel] conversation.followup error:", err);
              }
            }, 0);
          }
          return;
        }

        // Handle MOCA test action
        if (action.type === "moca.start") {
          if (isDev) {
            console.debug("[ChatKitPanel] opening resource panel for MOCA test");
          }
          onOpenResourcePanel();
          return;
        }

        // Handle weather refresh action
        if (action.type === "refresh_weather") {
          try {
            const location = action.location || "San Francisco";
            if (isDev) {
              console.debug("[ChatKitPanel] refreshing weather for:", location);
            }

            const response = await fetch("/api/tools", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                toolName: "get_weather",
                params: { location },
              }),
            });

            const data = await response.json();

            // Note: Cannot access chatkit.control here, so we can't send actions back
            if (data.success) {
              console.debug("[ChatKitPanel] weather data refreshed:", data);
            }
          } catch (error) {
            console.error("[ChatKitPanel] weather refresh error:", error);
          }
          return;
        }

        // Handle legacy save action (backward compatibility)
        if (action.type === "save") {
          const factAction = action as FactAction;
          await onWidgetAction(factAction);
          return;
        }

        // Warn about unhandled action types
        console.warn("[ChatKitPanel] unhandled widget action type:", action.type);
      },
    },
    onClientTool: async (invocation: {
      name: string;
      params: Record<string, unknown>;
    }) => {
      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          if (isDev) {
            console.debug("[ChatKitPanel] switch_theme", requested);
          }
          onThemeRequest(requested);
          return { success: true };
        }
        return { success: false };
      }

      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");
        if (!id || processedFacts.current.has(id)) {
          return { success: true };
        }
        processedFacts.current.add(id);
        void onWidgetAction({
          type: "save",
          factId: id,
          factText: text.replace(/\s+/g, " ").trim(),
        });
        return { success: true };
      }

      if (invocation.name === "get_weather") {
        try {
          if (isDev) {
            console.debug("[ChatKitPanel] get_weather", invocation.params);
          }
          
          // 调用服务器端API route
          const response = await fetch("/api/tools", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              toolName: "get_weather",
              params: invocation.params,
            }),
          });

          // Check if response is HTML (error page) instead of JSON
          const contentType = response.headers.get("content-type");
          if (!response.ok || !contentType?.includes("application/json")) {
            const text = await response.text();
            console.error("[ChatKitPanel] get_weather non-JSON response:", text.substring(0, 200));
            return { success: false, error: `Server error (${response.status}): Unable to fetch weather data` };
          }

          const data = await response.json();
          
          // Return widget data - Agent Builder will handle the conversational text
          if (data.success) {
            return {
              success: true,
              widget: {
                name: "weatherForecast",
                state: {
                  background: data.background,
                  conditionImage: data.conditionImage,
                  lowTemperature: data.lowTemperature,
                  highTemperature: data.highTemperature,
                  location: data.location,
                  conditionDescription: data.conditionDescription,
                  forecast: data.forecast
                }
              }
            };
          }
          
          return data;
        } catch (error) {
          console.error("[ChatKitPanel] get_weather error", error);
          return { success: false, error: "Failed to fetch weather data. Please try again." };
        }
      }

      // Supabase tools
      if (invocation.name === "get_user_profile") {
        // Check authentication before making API call
        if (!isSignedIn) {
          if (isDev) {
            console.debug("[ChatKitPanel] get_user_profile blocked - user not signed in");
          }
          return { success: false, error: "User profile requires authentication. Please sign in to save your preferences." };
        }
        
        try {
          if (isDev) {
            console.debug("[ChatKitPanel] get_user_profile", invocation.params);
          }
          
          const response = await fetch("/api/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toolName: "get_user_profile",
              params: invocation.params,
            }),
          });

          // Check if response is HTML (error page) instead of JSON
          const contentType = response.headers.get("content-type");
          if (!response.ok || !contentType?.includes("application/json")) {
            const text = await response.text();
            console.error("[ChatKitPanel] get_user_profile non-JSON response:", text.substring(0, 200));
            
            // Guest users don't have profiles - this is expected
            if (response.status === 401 || response.status === 403) {
              return { success: false, error: "User profile requires authentication. Please sign in to save your preferences." };
            }
            
            return { success: false, error: `Server error (${response.status}): Unable to get user profile` };
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error("[ChatKitPanel] get_user_profile error", error);
          return { success: false, error: "Failed to get user profile. This feature requires authentication." };
        }
      }

      if (invocation.name === "save_user_profile") {
        // Check authentication before making API call
        if (!isSignedIn) {
          if (isDev) {
            console.debug("[ChatKitPanel] save_user_profile blocked - user not signed in");
          }
          return { success: false, error: "Saving profile requires authentication. Please sign in to save your preferences." };
        }
        
        try {
          if (isDev) {
            console.debug("[ChatKitPanel] save_user_profile", invocation.params);
          }
          
          const response = await fetch("/api/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toolName: "save_user_profile",
              params: invocation.params,
            }),
          });

          // Check if response is HTML (error page) instead of JSON
          const contentType = response.headers.get("content-type");
          if (!response.ok || !contentType?.includes("application/json")) {
            const text = await response.text();
            console.error("[ChatKitPanel] save_user_profile non-JSON response:", text.substring(0, 200));
            
            // Guest users can't save profiles - this is expected
            if (response.status === 401 || response.status === 403) {
              return { success: false, error: "Saving profile requires authentication. Please sign in to save your preferences." };
            }
            
            return { success: false, error: `Server error (${response.status}): Unable to save user profile` };
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error("[ChatKitPanel] save_user_profile error", error);
          return { success: false, error: "Failed to save user profile. This feature requires authentication." };
        }
      }

      if (invocation.name === "get_trial_interests") {
        // Check authentication before making API call
        if (!isSignedIn) {
          if (isDev) {
            console.debug("[ChatKitPanel] get_trial_interests blocked - user not signed in");
          }
          return { success: false, error: "Accessing saved interests requires authentication. Please sign in to view your saved trials." };
        }
        
        try {
          if (isDev) {
            console.debug("[ChatKitPanel] get_trial_interests", invocation.params);
          }
          
          const response = await fetch("/api/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toolName: "get_trial_interests",
              params: invocation.params,
            }),
          });

          // Check if response is HTML (error page) instead of JSON
          const contentType = response.headers.get("content-type");
          if (!response.ok || !contentType?.includes("application/json")) {
            const text = await response.text();
            console.error("[ChatKitPanel] get_trial_interests non-JSON response:", text.substring(0, 200));
            
            // Guest users can't access saved interests - this is expected
            if (response.status === 401 || response.status === 403) {
              return { success: false, error: "Accessing saved interests requires authentication. Please sign in to view your saved trials." };
            }
            
            return { success: false, error: `Server error (${response.status}): Unable to get trial interests` };
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error("[ChatKitPanel] get_trial_interests error", error);
          return { success: false, error: "Failed to get trial interests. This feature requires authentication." };
        }
      }

      if (invocation.name === "save_trial_interest") {
        // Check authentication before making API call
        if (!isSignedIn) {
          if (isDev) {
            console.debug("[ChatKitPanel] save_trial_interest blocked - user not signed in");
          }
          return { success: false, error: "Saving trial interests requires authentication. Please sign in to save trials for later." };
        }
        
        try {
          if (isDev) {
            console.debug("[ChatKitPanel] save_trial_interest", invocation.params);
          }
          
          const response = await fetch("/api/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toolName: "save_trial_interest",
              params: invocation.params,
            }),
          });

          // Check if response is HTML (error page) instead of JSON
          const contentType = response.headers.get("content-type");
          if (!response.ok || !contentType?.includes("application/json")) {
            const text = await response.text();
            console.error("[ChatKitPanel] save_trial_interest non-JSON response:", text.substring(0, 200));
            
            // Guest users can't save interests - this is expected
            if (response.status === 401 || response.status === 403) {
              return { success: false, error: "Saving trial interests requires authentication. Please sign in to save trials for later." };
            }
            
            return { success: false, error: `Server error (${response.status}): Unable to save trial interest` };
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error("[ChatKitPanel] save_trial_interest error", error);
          return { success: false, error: "Failed to save trial interest. This feature requires authentication." };
        }
      }

      // Clinical trials search
      if (invocation.name === "get_trials") {
        try {
          if (isDev) {
            console.debug("[ChatKitPanel] get_trials", invocation.params);
          }
          
          const response = await fetch("/api/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toolName: "get_trials",
              params: invocation.params,
            }),
          });

          // Check if response is HTML (error page) instead of JSON
          const contentType = response.headers.get("content-type");
          if (!response.ok || !contentType?.includes("application/json")) {
            const text = await response.text();
            console.error("[ChatKitPanel] get_trials non-JSON response:", text.substring(0, 200));
            return { success: false, error: `Server error (${response.status}): Unable to search clinical trials` };
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error("[ChatKitPanel] get_trials error", error);
          return { success: false, error: "Failed to search clinical trials. Please try again." };
        }
      }

      return { success: false };
    },
    onResponseEnd: () => {
      onResponseEnd();
    },
    onResponseStart: () => {
      setErrorState({ integration: null, retryable: false });
    },
    onThreadChange: () => {
      processedFacts.current.clear();
    },
    onError: ({ error }: { error: unknown }) => {
      // Note that Chatkit UI handles errors for your users.
      // Thus, your app code doesn't need to display errors on UI.
      console.error("ChatKit error", error);
    },
  });

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;

  if (isDev) {
    console.debug("[ChatKitPanel] render state", {
      isInitializingSession,
      hasControl: Boolean(chatkit.control),
      scriptStatus,
      hasError: Boolean(blockingError),
      workflowId: WORKFLOW_ID,
    });
  }

  useEffect(() => {
    if (chatkit.control && isInitializingSession) {
      log("ChatKit ready → stop loading");
      setIsInitializingSession(false);
    }
  }, [chatkit.control, isInitializingSession]);

  // Helper to trigger smooth fade-out then remove overlay.
  // `extraDelay` lets callers hold the skeleton longer to cover web component paint time.
  const markContentReady = useCallback((extraDelay = 0) => {
    if (isContentReady) return;
    setTimeout(() => {
      setIsOverlayFadingOut(true);
      setTimeout(() => setIsContentReady(true), 700); // match transition duration
    }, extraDelay);
  }, [isContentReady]);

  // Keep ref in sync so getClientSecret can call it
  useEffect(() => {
    markContentReadyRef.current = markContentReady;
  }, [markContentReady]);

  // Fallback: clear skeleton 1.5s after session is ready (if createSession callback never fires)
  useEffect(() => {
    if (isInitializingSession || isContentReady) return;
    const t = setTimeout(() => {
      log('fallback timeout → force content ready');
      markContentReady();
    }, 2500);
    return () => clearTimeout(t);
  }, [isInitializingSession, isContentReady, markContentReady]);

  // Auto-open match modal when chatkit becomes ready (triggered by ?open_match=1)
  const autoMatchFiredRef = useRef(false);
  useEffect(() => {
    if (autoOpenMatch && chatkit.control && !isInitializingSession && !autoMatchFiredRef.current) {
      autoMatchFiredRef.current = true;
      setShowMatchModal(true);
    }
  }, [autoOpenMatch, chatkit.control, isInitializingSession]);

  // Auto-send clinician pre-screen message when chatkit becomes ready
  const autoClinicianFiredRef = useRef(false);
  useEffect(() => {
    if (!chatkit.control || isInitializingSession || autoClinicianFiredRef.current) return;
    if (!isBrowser) return;
    const message = sessionStorage.getItem('clinician_prescreen_prompt');
    if (!message) return;
    autoClinicianFiredRef.current = true;
    sessionStorage.removeItem('clinician_prescreen_prompt');
    setTimeout(async () => {
      try {
        await chatkit.sendUserMessage({ text: message });
      } catch (err) {
        console.error('[ChatKitPanel] Clinician pre-screen send failed:', err);
      }
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatkit.control, isInitializingSession]);

  // Note: Intake context is now passed via workflow.state_variables during session creation
  // See /app/api/create-session/route.ts for implementation

  // Handle voice input transcript
  const handleVoiceTranscript = useCallback((transcript: string) => {
    const correctedText = correctMedicalTerms(transcript);
    
    if (isDev) {
      console.log("[VoiceInput] Original:", transcript);
      console.log("[VoiceInput] Corrected:", correctedText);
      console.log("[VoiceInput] ChatKit control available:", Boolean(chatkit.control));
      console.log("[VoiceInput] ChatKit ref available:", Boolean(chatkit.ref?.current));
      console.log("[VoiceInput] Is initializing:", isInitializingSession);
    }

    if (!correctedText.trim()) {
      return;
    }

    // Wait for ChatKit to be fully ready
    if (!chatkit.control || isInitializingSession) {
      console.warn('[VoiceInput] ⚠️ ChatKit not ready yet, waiting...');
      // Retry after a short delay
      setTimeout(() => {
        if (chatkit.control && !isInitializingSession) {
          handleVoiceTranscript(transcript);
        } else {
          console.error('[VoiceInput] ❌ ChatKit still not ready after delay');
        }
      }, 500);
      return;
    }

    // Use ChatKit's official setComposerValue API
    try {
      // Try using the ref.current instance directly
      if (chatkit.ref?.current) {
        chatkit.ref.current.setComposerValue({ text: correctedText });
        chatkit.ref.current.focusComposer();
        if (isDev) {
          console.log('[VoiceInput] ✅ Text set via ref.current.setComposerValue');
        }
      } else {
        // Fallback to direct method call
        chatkit.setComposerValue({ text: correctedText });
        chatkit.focusComposer?.();
        if (isDev) {
          console.log('[VoiceInput] ✅ Text set via chatkit.setComposerValue');
        }
      }
    } catch (err) {
      console.error('[VoiceInput] ❌ Failed to set composer value:', err);
    }
  }, [chatkit, isInitializingSession]);
  
  return (
    <div className="flex flex-col h-full gap-0">
      {/* ── Mobile only: Header bar with Match button ── */}
      <div className="flex md:hidden items-center rounded-t-3xl justify-between px-5 py-2.5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50 shrink-0 z-20 overflow-hidden">
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Chat Panel</span>
        <div className="shimmer-border-btn-pill transition-transform hover:scale-105 active:scale-95 shadow-md shadow-blue-500/20">
          <button
            onClick={() => intakeData?.role === 'clinician' ? setShowClinicianModal(true) : setShowMatchModal(true)}
            className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm focus:outline-none"
            aria-label={intakeData?.role === 'clinician' ? 'Screen a patient for clinical trials' : 'Find matching clinical trials'}
          >
            <svg className="w-4 h-4 text-blue-600 fill-current" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <span className="font-bold tracking-wide bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
              {intakeData?.role === 'clinician' ? 'Screen a patient' : 'Find matching trials'}
            </span>
          </button>
        </div>
      </div>

    <div className="chatkit-panel-container relative pb-8 flex flex-1 w-full h-full rounded-b-3xl md:rounded-3xl flex-col overflow-hidden border border-slate-200/60 shadow-2xl transition-colors dark:bg-[#181D26] dark:border-slate-700/60 bg-[#FDFDFE]" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 15px rgba(0, 0, 0, 0.1)' }}>
      <ChatKit
        key={widgetInstanceKey}
        control={chatkit.control}
        className="block h-full w-full"
      />

      {/* Skeleton overlay — fades out smoothly once content is ready */}
      {!blockingError && !isContentReady && (
        <div
          className="absolute inset-0 z-10 flex flex-col justify-end px-8 py-10 bg-white/95 dark:bg-[#181D26]/95 backdrop-blur-sm"
          style={{
            opacity: isOverlayFadingOut ? 0 : 1,
            transition: 'opacity 700ms ease-in-out',
            pointerEvents: 'none',
          }}
        >
          <div />
          {/* Greeting skeleton */}
          <div className="h-15 w-[70%] mx-auto rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 animate-pulse mb-3" />
          {/* Prompt pills */}
          <div className="flex flex-col items-center gap-2.5 mb-4">
            {[70, 70, 70].map((w, i) => (
              <div
                key={i}
                className="h-8 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 animate-pulse my-1"
                style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
          {/* Composer */}
          <div className="h-15 w-[70%] mx-auto rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 animate-pulse mb-3" />
        </div>
      )}
      
      {/* Voice Input Button - positioned at same level as ChatKit */}
      {!blockingError && isContentReady && (
        <div 
          className="absolute bottom-11 md:bottom-13 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] md:w-[calc(100%-40px)] max-w-[771px] flex items-center justify-end pointer-events-none"
          style={{ height: '56px' }}
        >
          <VoiceInputButtonSwitcher onTranscript={handleVoiceTranscript} className="mr-14 pointer-events-auto" />
        </div>
      )}

      {/* ── Desktop only: Match button floating top-center ── */}
      <div className="hidden md:block absolute top-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto shimmer-border-btn-pill transition-transform hover:scale-105 active:scale-95 shadow-xl shadow-blue-500/40">
        <button
          onClick={() => intakeData?.role === 'clinician' ? setShowClinicianModal(true) : setShowMatchModal(true)}
          className="flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-base focus:outline-none select-none"
          aria-label={intakeData?.role === 'clinician' ? 'Screen a client for clinical trials' : 'Find matching clinical trials'}
        >
          <svg className="w-[18px] h-[18px] text-blue-600 fill-current" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <span className="font-bold tracking-wide bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
            {intakeData?.role === 'clinician' ? 'Screen a patient' : 'Find matching trials'}
          </span>
        </button>
      </div>

      {/* Match Profile Modal */}
      {showMatchModal && (
        <MatchProfileModal
          onConfirm={async (_profile: MatchProfile, message: string) => {
            setShowMatchModal(false);
            if (chatkit.control) {
              try {
                await chatkit.sendUserMessage({ text: message });
              } catch (err) {
                console.error("[MatchButton] sendUserMessage failed:", err);
              }
            }
          }}
          onClose={() => setShowMatchModal(false)}
        />
      )}

      {/* Clinician Patient Screen Modal */}
      {showClinicianModal && (
        <ClinicianModal
          initialStep="prescreen"
          onConfirm={async (message: string) => {
            setShowClinicianModal(false);
            if (chatkit.control) {
              try {
                await chatkit.sendUserMessage({ text: message });
              } catch (err) {
                console.error("[ClinicianModal] sendUserMessage failed:", err);
              }
            }
          }}
          onClose={() => setShowClinicianModal(false)}
        />
      )}
      
      <ErrorOverlay
        error={blockingError}
        fallbackMessage={null}
        onRetry={blockingError && errors.retryable ? handleResetChat : null}
        retryLabel="Restart chat"
      />
    </div>
    </div>
  );
}

function extractErrorDetail(
  payload: Record<string, unknown> | undefined,
  fallback: string
): string {
  if (!payload) {
    return fallback;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  const details = payload.details;
  if (typeof details === "string") {
    return details;
  }

  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") {
      return nestedError;
    }
    if (
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof (nestedError as { message?: unknown }).message === "string"
    ) {
      return (nestedError as { message: string }).message;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}
