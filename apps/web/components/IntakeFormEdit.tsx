"use client";

import { useState } from "react";
import type { UserRole, ResponseStyle, UserIntent, IntakeData } from "@/lib/types/intake";

interface IntakeFormEditProps {
  initialData: IntakeData;
  onSave: (data: IntakeData) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function IntakeFormEdit({ initialData, onSave, onCancel, isSaving = false }: IntakeFormEditProps) {
  const [role, setRole] = useState<UserRole | null>(initialData.role);
  const [responseStyle, setResponseStyle] = useState<ResponseStyle | null>(initialData.response_style);
  const [intent, setIntent] = useState<UserIntent | null>(initialData.intent);

  const handleSave = () => {
    const data: IntakeData = {
      role,
      response_style: responseStyle,
      intent,
      completed_at: new Date().toISOString(),
    };
    onSave(data);
  };

  const hasChanges = 
    role !== initialData.role ||
    responseStyle !== initialData.response_style ||
    intent !== initialData.intent;

  return (
    <div className="space-y-8">
      {/* Role Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Who are you looking for information for?
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This helps us tailor our responses to your needs
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setRole('user')}
            className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
              role === 'user'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className={`font-medium ${
              role === 'user'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              Myself
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              I&apos;m looking for information for myself
            </div>
          </button>

          <button
            onClick={() => setRole('caregiver')}
            className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
              role === 'caregiver'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className={`font-medium ${
              role === 'caregiver'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              Someone else
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              I&apos;m helping someone else to find information
            </div>
          </button>

          <button
            onClick={() => setRole('clinician')}
            className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
              role === 'clinician'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className={`font-medium ${
              role === 'clinician'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              As a clinician
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              I&apos;m a healthcare professional seeking clinical information
            </div>
          </button>
        </div>
      </div>

      {/* Response Style Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Communication Style
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            How would you prefer to receive information?
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setResponseStyle('concise')}
            className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
              responseStyle === 'concise'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className={`font-medium ${
              responseStyle === 'concise'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              Brief & Direct
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Get straight to the point with essential information
            </div>
          </button>

          <button
            onClick={() => setResponseStyle('balanced')}
            className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
              responseStyle === 'balanced'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className={`font-medium ${
              responseStyle === 'balanced'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              Balanced
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              A good mix of detail and clarity
            </div>
          </button>

          <button
            onClick={() => setResponseStyle('verbose')}
            className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
              responseStyle === 'verbose'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className={`font-medium ${
              responseStyle === 'verbose'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              Detailed & Comprehensive
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              In-depth explanations with context and examples
            </div>
          </button>
        </div>
      </div>

      {/* Intent Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Your Goal
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            What brings you here today?
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setIntent('learn_about_alzheimer')}
            className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
              intent === 'learn_about_alzheimer'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className={`flex items-center gap-2 font-medium ${
              intent === 'learn_about_alzheimer'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              Learn About Alzheimer&apos;s Disease
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300">Default</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              I want to learn about Alzheimer&apos;s disease and ADRD
            </div>
          </button>

          <button
            onClick={() => setIntent('trial_matching')}
            className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
              intent === 'trial_matching'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className={`font-medium ${
              intent === 'trial_matching'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              Find Suitable Clinical Trials
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Help me search for and match with clinical trials
            </div>
          </button>

          <button
            onClick={() => setIntent('learn_about_trials')}
            className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
              intent === 'learn_about_trials'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className={`font-medium ${
              intent === 'learn_about_trials'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              Learn About Clinical Trials
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              I want to understand what clinical trials are
            </div>
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {hasChanges && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
          💡 Your next chat will use these new preferences
        </p>
      )}
    </div>
  );
}
