"use client";

import { useState, useEffect } from "react";

const MATCH_PROFILE_KEY = "match_profile_data";

export interface MatchProfile {
  age: string;
  gender: string;
  zipcode: string;
}

interface MatchProfileModalProps {
  onConfirm: (profile: MatchProfile, message: string) => void;
  onClose: () => void;
}

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export function MatchProfileModal({ onConfirm, onClose }: MatchProfileModalProps) {
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [errors, setErrors] = useState<Partial<MatchProfile>>({});

  // Pre-fill from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(MATCH_PROFILE_KEY);
    if (stored) {
      try {
        const profile = JSON.parse(stored) as MatchProfile;
        if (profile.age) setAge(profile.age);
        if (profile.gender) setGender(profile.gender);
        if (profile.zipcode) setZipcode(profile.zipcode);
      } catch {
        // ignore
      }
    }
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<MatchProfile> = {};
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

  const handleConfirm = () => {
    if (!validate()) return;

    const profile: MatchProfile = { age: age.trim(), gender, zipcode: zipcode.trim() };

    // Persist to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(MATCH_PROFILE_KEY, JSON.stringify(profile));
    }

    const genderLabel = GENDER_OPTIONS.find((g) => g.value === gender)?.label ?? gender;
    const message = `I am a ${age}-year-old ${genderLabel.toLowerCase()}, living in ZIP code ${zipcode.trim()}. Please help me find matching clinical trials.`;

    onConfirm(profile, message);
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md overflow-y-auto"
      onClick={handleBackdropClick}
    >
      {/* Centering wrapper — padding ensures modal never clips at top/bottom on mobile */}
      <div className="flex min-h-full items-center justify-center p-4">

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Card body */}
        <div className="relative rounded-2xl bg-white dark:bg-[#0f1623] border border-blue-100/40 dark:border-blue-900/30 p-8">

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2.5 mb-1.5">
              {/* Zap icon matching Match button */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-900/40 dark:to-sky-900/30 flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-4 h-4 text-blue-600 fill-current" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                Find Your Match
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Tell us a bit about yourself to find the most relevant clinical trials.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">

            {/* Age */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Age
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 45"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 transition-all"
              />
              {errors.age && (
                <p className="mt-1 text-xs text-red-500">{errors.age}</p>
              )}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Gender
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
                <p className="mt-1 text-xs text-red-500">{errors.gender}</p>
              )}
            </div>

            {/* ZIP Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                ZIP Code
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
                <p className="mt-1 text-xs text-red-500">{errors.zipcode}</p>
              )}
            </div>
          </div>

          {/* Confirm button — rotating gradient border via padding technique, no overflow-hidden needed */}
          <div className="mt-6 shadow-lg shadow-blue-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ borderRadius: '12px' }}>
            <div className="shimmer-border-btn">
              <button
                onClick={handleConfirm}
                className="group w-full focus:outline-none py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                style={{ borderRadius: '10px' }}
              >
                <svg className="w-4 h-4 text-blue-600 fill-current" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                  Find Matching Trials
                </span>
                <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Clear button */}
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(MATCH_PROFILE_KEY);
                }
                setAge('');
                setGender('');
                setZipcode('');
                setErrors({});
              }}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors underline-offset-2 hover:underline"
            >
              clear
            </button>
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}
