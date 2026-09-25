"use client";

import { useClinicianMode } from "@/hooks/useClinicianMode";

/**
 * Rendered above <Header /> (see (main)/layout.tsx) so it reads as a
 * standalone site-wide status strip rather than being visually attached
 * to the header bar. Logic lives in `useClinicianMode` (hooks/useClinicianMode.ts);
 * this component is presentation-only.
 */
export default function ClinicianModeBanner() {
  const { isClinicianMode, exitClinicianMode } = useClinicianMode();

  if (!isClinicianMode) return null;

  return (
    <div className="flex-none w-full bg-emerald-600 dark:bg-emerald-700 text-white z-40">
      <div className="mx-auto max-w-7xl w-[95%] flex items-center justify-between gap-3 py-2 px-1">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-sm font-semibold tracking-wide">Clinician Mode</span>
          <span className="hidden sm:inline text-sm text-emerald-100">— viewing as a healthcare professional</span>
        </div>
        <button
          onClick={exitClinicianMode}
          className="flex items-center gap-1.5 text-xs font-medium text-emerald-100 hover:text-white transition-colors whitespace-nowrap underline underline-offset-2 decoration-emerald-300 hover:decoration-white"
        >
          Exit clinician mode
        </button>
      </div>
    </div>
  );
}
