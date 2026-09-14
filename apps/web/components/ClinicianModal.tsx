"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeData } from "@/lib/types/intake";
import { INTAKE_STORAGE_KEY } from "@/lib/types/intake";

const CLINICIAN_PRESCREEN_KEY = "clinician_prescreen_prompt";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

interface ClinicianModalProps {
  onClose: () => void;
  initialStep?: "intent" | "prescreen";
  onConfirm?: (message: string) => void;
}

export function ClinicianModal({ onClose, initialStep = "intent", onConfirm }: ClinicianModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<"intent" | "prescreen">(initialStep);

  // Pre-screen form state
  const [age, setAge] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [gender, setGender] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const saveIntake = (intent: "learn_about_trials" | "trial_matching") => {
    const data: IntakeData = {
      role: "clinician",
      intent,
      response_style: "balanced",
      completed_at: new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(data));
    }
  };

  const handleLearnAboutTrials = () => {
    saveIntake("learn_about_trials");
    router.push("/trial-chat/chat");
  };

  const validatePrescreen = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!age || isNaN(Number(age)) || Number(age) < 1 || Number(age) > 120) {
      newErrors.age = "Please enter a valid age (1–120)";
    }
    if (!gender) {
      newErrors.gender = "Please select a gender";
    }
    if (!zipcode || !/^\d{5}(-\d{4})?$/.test(zipcode.trim())) {
      newErrors.zipcode = "Please enter a valid US ZIP code";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePrescreenSubmit = () => {
    if (!validatePrescreen()) return;

    saveIntake("trial_matching");

    const genderLabel =
      GENDER_OPTIONS.find((g) => g.value === gender)?.label ?? gender;

    let message = `I am a clinician helping pre-screen a patient for potential ADRD clinical trial matches.\nThe patient is ${age} years old, located in ZIP ${zipcode.trim()}, sex/gender: ${genderLabel}.`;
    if (diagnosis.trim()) {
      message += `\nClinical context: ${diagnosis.trim()}.`;
    }
    if (notes.trim()) {
      message += `\nAdditional notes: ${notes.trim()}.`;
    }
    message +=
      "\n\nPlease identify potentially relevant ADRD clinical trials, explain why they may be suitable, and list additional eligibility information that should be confirmed.";

    if (onConfirm) {
      onConfirm(message);
    } else {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(CLINICIAN_PRESCREEN_KEY, message);
      }
      router.push("/trial-chat/chat");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-sm rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative rounded-2xl bg-white dark:bg-[#0f1623] border border-blue-100/40 dark:border-white/10 p-8">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {step === "intent" ? (
              /* ── Step 1: Intent selection ── */
              <div>
                <div className="mb-6">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-700/40 flex items-center justify-center shrink-0 shadow-sm border border-slate-200/60 dark:border-white/10">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-4 h-4 text-slate-600 dark:text-slate-300"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                        />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                      Clinician Access
                    </h2>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    What would you like to do today?
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Option 1: Learn about ADRD trials */}
                  <button
                    onClick={handleLearnAboutTrials}
                    className="group w-full p-4 text-left rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                          Learn about ADRD trials
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Eligibility criteria, risks, referral guidance
                        </div>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                        />
                      </svg>
                    </div>
                  </button>

                  {/* Option 2: Pre-screen a patient */}
                  <button
                    onClick={() => setStep("prescreen")}
                    className="group w-full p-4 text-left rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-600/60 hover:bg-blue-50/60 dark:hover:bg-blue-900/20 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                          Pre-screen a patient for trial matching
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Provide patient details to find relevant trials
                        </div>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                        />
                      </svg>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* ── Step 2: Pre-screen form ── */
              <div>
                <div className="mb-5">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <button
                      onClick={() => initialStep === "prescreen" ? onClose() : setStep("intent")}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors -ml-1"
                      aria-label="Back"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                        />
                      </svg>
                    </button>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                      Patient Pre-screen
                    </h2>
                  </div>
                  <div className="flex items-start gap-1.5 mt-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                      />
                    </svg>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Please do not include directly identifying client
                      information.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Age */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Client Age <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="e.g. 72"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                    />
                    {errors.age && (
                      <p className="mt-1 text-xs text-red-500">{errors.age}</p>
                    )}
                  </div>

                  {/* ZIP Code */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      ZIP Code <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={zipcode}
                      onChange={(e) => setZipcode(e.target.value)}
                      placeholder="e.g. 10001"
                      maxLength={10}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                    />
                    {errors.zipcode && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.zipcode}
                      </p>
                    )}
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Sex / Gender <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {GENDER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGender(opt.value)}
                          className={`w-full rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                            gender === opt.value
                              ? "border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                              : "border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {errors.gender && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.gender}
                      </p>
                    )}
                  </div>

                  {/* Diagnosis (optional) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Diagnosis / Cognitive Status{" "}
                      <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="e.g. MCI, early-stage AD"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
                    />
                  </div>

                  {/* Notes (optional) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Additional Notes{" "}
                      <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. currently on memantine, trial preference..."
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <div
                  className="mt-6 shadow-lg shadow-blue-500/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ borderRadius: "12px" }}
                >
                  <div className="shimmer-border-btn">
                    <button
                      onClick={handlePrescreenSubmit}
                      className="group w-full focus:outline-none py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                      style={{ borderRadius: "10px" }}
                    >
                      <svg
                        className="w-4 h-4 text-blue-600 fill-current"
                        viewBox="0 0 24 24"
                      >
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                        Start Pre-screening
                      </span>
                      <svg
                        className="w-4 h-4 text-sky-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
