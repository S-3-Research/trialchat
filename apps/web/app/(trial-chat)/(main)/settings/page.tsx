"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IntakeFormEdit } from "@/components/IntakeFormEdit";
import type { IntakeData } from "@/lib/types/intake";
import { INTAKE_STORAGE_KEY } from "@/lib/types/intake";

export default function SettingsPage() {
  const router = useRouter();
  const [intakeData, setIntakeData] = useState<IntakeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(INTAKE_STORAGE_KEY);
      if (stored) setIntakeData(JSON.parse(stored) as IntakeData);
    } catch (error) {
      console.error("[Settings] Error loading preferences:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSave = async (data: IntakeData) => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(data));

      window.dispatchEvent(new CustomEvent("intake-preferences-updated"));
      window.dispatchEvent(new CustomEvent("intake-role-updated"));

      // Redirect to chat
      router.push("/chat");
    } catch (error) {
      console.error("[Settings] Error saving preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push("/chat");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-slate-600 dark:text-slate-400">Loading preferences...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar scroll-mask">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl bg-white/50 backdrop-blur-xl border border-slate-200/50 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/50 p-6 sm:p-8">
          <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            General Preferences
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Update your chat preferences. They are saved in this browser and used when you chat.
          </p>
        </div>

        {intakeData ? (
          <IntakeFormEdit
            initialData={intakeData}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              No preferences found. Complete the intake form to get started.
            </p>
            <button
              onClick={() => router.push("/chat")}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition shadow-sm"
            >
              Go to Chat
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
