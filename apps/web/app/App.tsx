"use client";

import { useCallback, useState, useEffect } from "react";
import { ChatKitPanel, type FactAction } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import ResourcePanel from "@/components/ResourcePanel";
import { IntakeFormModal } from "@/components/IntakeFormModal";
import type { IntakeData } from "@/lib/types/intake";
import { INTAKE_STORAGE_KEY } from "@/lib/types/intake";

interface AppProps {
  skipIntake?: boolean;
  autoOpenMatch?: boolean;
}

export default function App({ skipIntake = false, autoOpenMatch = false }: AppProps) {
  const { scheme, setScheme } = useColorScheme();
  const [isResourcePanelOpen, setIsResourcePanelOpen] = useState(false);
  // Sign-in is not supported; all users are treated as guests.
  const isLoaded = true;
  const isSignedIn = false;
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeCompleted, setIntakeCompleted] = useState(false);
  const [isMigratingIntake, setIsMigratingIntake] = useState(false);
  const [isCheckingIntake, setIsCheckingIntake] = useState(true); // New: track intake check status
  const [sessionKey, setSessionKey] = useState(0); // Track session resets for preference updates
  const [themeVersion, setThemeVersion] = useState(0); // Track theme changes for ChatKit refresh

  // Migrate localStorage intake data to Supabase when user signs in
  useEffect(() => {
    if (!isLoaded || !isSignedIn || isMigratingIntake) return;

    const migrateIntakeData = async () => {
      if (typeof window === "undefined") return;

      const stored = localStorage.getItem(INTAKE_STORAGE_KEY);
      if (!stored) return;

      try {
        setIsMigratingIntake(true);
        const data = JSON.parse(stored) as IntakeData;

        console.log("[App] Migrating intake data to Supabase...");

        const response = await fetch("/api/migrate-intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: data.role,
            response_style: data.response_style,
            intent: data.intent,
          }),
        });

        const result = await response.json();

        if (result.success) {
          console.log("[App] Intake data migrated successfully");
          // Clear localStorage after successful migration
          localStorage.removeItem(INTAKE_STORAGE_KEY);
        } else {
          console.error("[App] Failed to migrate intake data:", result.error);
        }
      } catch (error) {
        console.error("[App] Error migrating intake data:", error);
      } finally {
        setIsMigratingIntake(false);
      }
    };

    migrateIntakeData();
  }, [isLoaded, isSignedIn, isMigratingIntake]);

  // Listen for preference updates from settings page
  useEffect(() => {
    const handlePreferenceUpdate = () => {
      console.log("[App] Preferences updated, resetting session...");
      setSessionKey(prev => prev + 1); // Force ChatKitPanel remount
    };

    window.addEventListener('intake-preferences-updated', handlePreferenceUpdate);
    return () => {
      window.removeEventListener('intake-preferences-updated', handlePreferenceUpdate);
    };
  }, []);

  // Listen for clinician mode exit — re-show intake modal so user can re-select role
  useEffect(() => {
    const handleClinicianModeExited = () => {
      console.log("[App] Clinician mode exited — resetting intake state");
      setIntakeCompleted(false);
      setShowIntakeModal(true);
      setIsCheckingIntake(false);
    };

    window.addEventListener('clinician-mode-exited', handleClinicianModeExited);
    return () => {
      window.removeEventListener('clinician-mode-exited', handleClinicianModeExited);
    };
  }, []);

  // Update theme version when scheme changes to force ChatKit refresh
  useEffect(() => {
    setThemeVersion(prev => prev + 1);
  }, [scheme]);

  // Check if intake is needed for all users (guest and signed in)
  useEffect(() => {
    if (!isLoaded || isMigratingIntake) return;

    // If coming from landing page "Match me to Trials" button, skip intake entirely
    if (skipIntake) {
      setIntakeCompleted(true);
      setShowIntakeModal(false);
      setIsCheckingIntake(false);
      return;
    }

    const checkIntakeStatus = async () => {
      if (typeof window === "undefined") return;

      // First check localStorage (for guest users or recent data)
      const stored = localStorage.getItem(INTAKE_STORAGE_KEY);
      if (stored) {
        setIntakeCompleted(true);
        setShowIntakeModal(false);
        setIsCheckingIntake(false); // Mark check as complete
        return;
      }

      // For signed in users, check Supabase
      if (isSignedIn) {
        try {
          console.log("[App] Checking Supabase for intake data...");
          const response = await fetch("/api/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toolName: "get_user_profile",
              params: {},
            }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log("[App] Supabase check result:", result);
            
            // If user has intake data in Supabase, sync to localStorage and skip modal
            if (result.success && result.data?.intake_completed_at) {
              console.log("[App] User has completed intake in Supabase");
              
              // Sync Supabase data to localStorage for ChatKit session creation
              const intakeData: IntakeData = {
                role: result.data.intake_role,
                response_style: result.data.intake_response_style,
                intent: result.data.intake_intent,
                completed_at: result.data.intake_completed_at,
              };
              localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(intakeData));
              console.log("[App] Synced Supabase intake data to localStorage:", intakeData);
              
              setIntakeCompleted(true);
              setShowIntakeModal(false);
              setIsCheckingIntake(false); // Mark check as complete
              return;
            } else {
              console.log("[App] No intake data found in Supabase:", {
                hasData: !!result.data,
                hasIntakeCompletedAt: !!result.data?.intake_completed_at,
              });
            }
          } else {
            console.error("[App] Failed to check Supabase:", response.status);
          }
        } catch (error) {
          console.error("[App] Error checking intake status:", error);
        }
      }

      // Show intake modal if no data found (both guest and signed in)
      setShowIntakeModal(true);
      setIntakeCompleted(false);
      setIsCheckingIntake(false); // Mark check as complete
    };

    checkIntakeStatus();
  }, [isLoaded, isSignedIn, isMigratingIntake, skipIntake]);

  const handleWidgetAction = useCallback(async (action: FactAction) => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[ChatKitPanel] widget action", action);
    }
  }, []);

  const handleResponseEnd = useCallback(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[ChatKitPanel] response end");
    }
  }, []);

  const handleIntakeComplete = useCallback(async (data: IntakeData) => {
    console.log("[App] Intake completed:", data);
    
    // For signed in users, save directly to Supabase
    if (isSignedIn) {
      try {
        console.log("[App] Saving intake data to Supabase...");
        const response = await fetch("/api/migrate-intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: data.role,
            response_style: data.response_style,
            intent: data.intent,
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          console.log("[App] Intake data saved to Supabase successfully");
        } else {
          console.error("[App] Failed to save intake data to Supabase:", result.error);
          // Fallback to localStorage if Supabase fails
          if (typeof window !== "undefined") {
            localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(data));
          }
        }
      } catch (error) {
        console.error("[App] Error saving intake data to Supabase:", error);
        // Fallback to localStorage if API call fails
        if (typeof window !== "undefined") {
          localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(data));
        }
      }
    } else {
      // For guest users, save to localStorage (already done by IntakeFormModal)
      console.log("[App] Guest user - data saved to localStorage");
    }
    
    setIntakeCompleted(true);
    setShowIntakeModal(false);
    // Notify Header to re-check the role badge
    window.dispatchEvent(new CustomEvent('intake-role-updated'));
  }, [isSignedIn]);

  const handleIntakeSkip = useCallback(() => {
    console.log("[App] Intake skipped — saving defaults to localStorage");
    const defaultData = {
      intent: 'learn_about_alzheimer',
      role: 'user',
      response_style: 'balanced',
      completed_at: new Date().toISOString(),
    };
    localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(defaultData));
    setIntakeCompleted(true);
    setShowIntakeModal(false);
  }, []);

  // Show loading state while checking auth or intake
  if (!isLoaded || isCheckingIntake) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <div className="text-slate-500 dark:text-slate-400">
          {!isLoaded ? 'Loading...' : 'Checking your preferences...'}
        </div>
      </main>
    );
  }

  // For guests, show intake modal first
  const shouldShowChat = isSignedIn || intakeCompleted;

  return (
    <main className="flex flex-1 flex-col items-center">
      {/* Intake Modal for Guest Users */}
      {showIntakeModal && (
        <IntakeFormModal
          onComplete={handleIntakeComplete}
          onSkip={handleIntakeSkip}
        />
      )}

      {/* Toggle Button - Fixed to top right */}
      {/* <button
        onClick={() => setIsResourcePanelOpen(!isResourcePanelOpen)}
        className="fixed right-6 top-20 z-50 rounded-full bg-white/90 p-2.5 text-slate-700 shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition hover:bg-white hover:shadow-xl dark:bg-slate-800/90 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-slate-800"
        aria-label={isResourcePanelOpen ? "Hide resources" : "Show resources"}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isResourcePanelOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          )}
        </svg>
      </button> */}

      <div className="main-layout-container mx-auto w-[95%] max-w-7xl flex-1 flex flex-col py-6 pb-10 transition-all duration-300 ease-in-out">
        {/* Panels Container */}
        <div className="flex gap-4 flex-1">
            <div className="flex-1 flex flex-col">
              {shouldShowChat ? (
                <ChatKitPanel
                  key={`${sessionKey}-${themeVersion}`}
                  theme={scheme}
                  onWidgetAction={handleWidgetAction}
                  onResponseEnd={handleResponseEnd}
                  onThemeRequest={setScheme}
                  onOpenResourcePanel={() => setIsResourcePanelOpen(true)}
                  autoOpenMatch={autoOpenMatch}
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-900">
                  <div className="text-center text-slate-500 dark:text-slate-400">
                    Complete the intake form to start chatting
                  </div>
                </div>
              )}
            </div>

            {isResourcePanelOpen && (
              <div className="flex-1 transition-all duration-300">
                <ResourcePanel
                  isOpen={isResourcePanelOpen}
                  onClose={() => setIsResourcePanelOpen(false)}
                />
              </div>
            )}
          </div>
      </div>
    </main>
  );
}
