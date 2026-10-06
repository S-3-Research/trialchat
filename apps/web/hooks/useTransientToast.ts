"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TransientToastVariant = "success" | "info";

export type TransientToastState = {
  /** Fresh per `show()` call so re-showing the same message still restarts the fade/timer and remounts the badge (its consumer should key on this). */
  id: string;
  message: string;
  variant: TransientToastVariant;
} | null;

/**
 * Generic "fire and forget" auto-dismissing status badge — shared by every
 * short-lived confirmation in the app (bookmark/unbookmark, a Panel filter
 * change landing successfully, etc.) so they all look and time out
 * identically instead of each call site rolling its own `setTimeout`.
 * Pair with `<TransientBadge toast={toast} />`
 * (components/ui/TransientBadge.tsx), which is purely presentational.
 */
export function useTransientToast(durationMs = 2200) {
  const [toast, setToast] = useState<TransientToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback(
    (message: string, variant: TransientToastVariant = "success") => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      clearTimeout(timerRef.current);
      setToast({ id, message, variant });
      timerRef.current = setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, durationMs);
    },
    [durationMs]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { toast, show };
}
