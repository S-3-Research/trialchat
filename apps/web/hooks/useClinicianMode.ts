"use client";

import { useEffect, useState } from "react";
import { INTAKE_STORAGE_KEY } from "@/lib/types/intake";

/**
 * Tracks whether the current visitor's intake role is "clinician" and
 * exposes a way to exit clinician mode.
 *
 * Extracted from Header.tsx so the Clinician Mode banner can be rendered
 * above <Header /> (its own flex-none row in the (main) layout) instead
 * of being visually attached below the header bar.
 *
 * Listens for both:
 * - `storage` (cross-tab changes to localStorage)
 * - `intake-role-updated` (same-tab signal, dispatched by IntakeFormModal
 *   and ClinicianModal right after they write INTAKE_STORAGE_KEY — same-tab
 *   writes don't fire native `storage` events, so this is required for the
 *   banner to appear/disappear without a full page reload)
 */
export function useClinicianMode() {
  const [isClinicianMode, setIsClinicianMode] = useState(false);

  useEffect(() => {
    const checkClinicianRole = () => {
      if (typeof window === "undefined") return;
      const stored = localStorage.getItem(INTAKE_STORAGE_KEY);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setIsClinicianMode(data.role === "clinician");
        } catch {
          setIsClinicianMode(false);
        }
      } else {
        setIsClinicianMode(false);
      }
    };

    checkClinicianRole();

    window.addEventListener("storage", checkClinicianRole);
    window.addEventListener("intake-role-updated", checkClinicianRole);

    return () => {
      window.removeEventListener("storage", checkClinicianRole);
      window.removeEventListener("intake-role-updated", checkClinicianRole);
    };
  }, []);

  const exitClinicianMode = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(INTAKE_STORAGE_KEY);
    }
    setIsClinicianMode(false);
    window.dispatchEvent(new CustomEvent("clinician-mode-exited"));
  };

  return { isClinicianMode, exitClinicianMode };
}
