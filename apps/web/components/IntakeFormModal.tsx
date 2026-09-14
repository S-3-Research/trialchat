"use client";

import { useState, useEffect } from "react";
import type { UserRole, ResponseStyle, UserIntent, IntakeData } from "@/lib/types/intake";
import { INTAKE_STORAGE_KEY } from "@/lib/types/intake";

interface IntakeFormModalProps {
  onComplete: (data: IntakeData) => void;
  onSkip?: () => void;
}

export function IntakeFormModal({ onComplete, onSkip }: IntakeFormModalProps) {
  const [step, setStep] = useState(1);
  const [intent, setIntent] = useState<UserIntent | null>('learn_about_alzheimer');
  const [role, setRole] = useState<UserRole | null>('user');
  const [responseStyle] = useState<ResponseStyle | null>('balanced');

  // Check if user has already completed intake
  useEffect(() => {
    const stored = localStorage.getItem(INTAKE_STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored) as IntakeData;
        onComplete(data);
      } catch (error) {
        console.error('Failed to parse stored intake data:', error);
      }
    }
  }, [onComplete]);

  const complete = (overrides?: Partial<IntakeData>) => {
    const data: IntakeData = {
      intent,
      role,
      response_style: responseStyle,
      completed_at: new Date().toISOString(),
      ...overrides,
    };
    localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(data));
    onComplete(data);
  };

  // Step 1: Goal — select intent then advance
  const handleIntentSelect = (selectedIntent: UserIntent) => {
    setIntent(selectedIntent);
    setStep(2);
  };

  // Step 2: Role — select role then advance
  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setStep(3);
  };

  // Step 3: Tone — select style then complete
  const handleStyleSelect = (selectedStyle: ResponseStyle) => {
    complete({ response_style: selectedStyle });
  };

  const handleSkipAll = () => {
    if (onSkip) {
      onSkip();
    } else {
      complete();
    }
  };

  const handleSkipFromStep2 = () => {
    setStep(3);
  };

  const handleSkipFromStep3 = () => {
    complete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 m-4">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Goal (Intent) */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Welcome! 👋
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                What brings you here today?
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleIntentSelect('learn_about_alzheimer')}
                className="w-full p-4 text-left rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-600 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    Learn About Alzheimer&apos;s Disease
                  </span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300">Default</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  I want to learn about Alzheimer&apos;s disease and ADRD
                </div>
              </button>

              <button
                onClick={() => handleIntentSelect('trial_matching')}
                className="w-full p-4 text-left rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Find Suitable Clinical Trials
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Help me search for and match with clinical trials
                </div>
              </button>

              <button
                onClick={() => handleIntentSelect('learn_about_trials')}
                className="w-full p-4 text-left rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Learn About Clinical Trials
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  I want to understand what clinical trials are
                </div>
              </button>
            </div>

            <button
              onClick={handleSkipAll}
              className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Step 2: Role */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Who are you looking for?
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                This helps us tailor our responses to your needs
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleRoleSelect('user')}
                className="w-full p-4 text-left rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-600 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    Myself
                  </span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300">Default</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  I&apos;m looking for information for myself
                </div>
              </button>

              <button
                onClick={() => handleRoleSelect('caregiver')}
                className="w-full p-4 text-left rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Someone else
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  I&apos;m helping someone else find information
                </div>
              </button>

              <button
                onClick={() => handleRoleSelect('clinician')}
                className="w-full p-4 text-left rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  As a clinician
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  I&apos;m a healthcare professional seeking clinical information
                </div>
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSkipFromStep2}
                className="flex-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Tone (Response Style) */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Communication Style
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                How would you prefer to receive information?
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleStyleSelect('concise')}
                className="w-full p-4 text-left rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Brief & Direct
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Get straight to the point with essential information
                </div>
              </button>

              <button
                onClick={() => handleStyleSelect('balanced')}
                className="w-full p-4 text-left rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-600 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    Balanced
                  </span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300">Default</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  A good mix of detail and clarity
                </div>
              </button>

              <button
                onClick={() => handleStyleSelect('verbose')}
                className="w-full p-4 text-left rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Detailed & Comprehensive
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  In-depth explanations with context and examples
                </div>
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSkipFromStep3}
                className="flex-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
