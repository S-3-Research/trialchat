"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Info } from "lucide-react";
import type { TransientToastState } from "@/hooks/useTransientToast";

/**
 * Small pill-shaped status badge, driven by `useTransientToast()`
 * (hooks/useTransientToast.ts) — purely presentational, renders nothing
 * once the hook's own timer clears the toast. Shared by every short-lived
 * confirmation in the app (bookmark/unbookmark, a Panel filter change
 * landing successfully, etc.) so they all look/animate identically.
 *
 * Inline — fine wherever the badge's own container has no
 * `overflow-hidden`/clipping ancestor (e.g. the Trial Panel header row).
 * For triggers inside a clipped card (e.g. a bookmark button on a trial
 * card), use `AnchoredTransientBadge` below instead.
 */
export function TransientBadge({ toast, className = "" }: { toast: TransientToastState; className?: string }) {
  if (!toast) return null;
  const Icon = toast.variant === "success" ? Check : Info;
  return (
    <span
      key={toast.id}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap animate-trial-card-enter ${
        toast.variant === "success"
          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
      } ${className}`}
    >
      <Icon className="w-3 h-3" strokeWidth={2.5} />
      {toast.message}
    </span>
  );
}

/**
 * Portal-rendered (into `document.body`) version of `TransientBadge`,
 * anchored to the bounding box of its `children` trigger — same technique
 * as components/ui/Tooltip.tsx, for the same reason: a bookmark button
 * lives inside a trial card, and every card/column ancestor in this app
 * uses `overflow-hidden` liberally for its rounded-corner/scroll-fade
 * chrome, which silently clips a plain `position: absolute` badge instead
 * of letting it float over the edge.
 */
export function AnchoredTransientBadge({
  toast,
  side = "right",
  children,
}: {
  toast: TransientToastState;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => setMounted(true), []);

  const GAP = 8;
  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let top = rect.top + rect.height / 2;
    let left = rect.right + GAP;
    if (side === "left") {
      left = rect.left - GAP;
    } else if (side === "top") {
      top = rect.top - GAP;
      left = rect.left + rect.width / 2;
    } else if (side === "bottom") {
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2;
    }
    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (!toast) return;
    updatePosition();
    const onReposition = () => updatePosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const transformBySide: Record<string, string> = {
    top: "translate(-50%, -100%)",
    bottom: "translate(-50%, 0)",
    left: "translate(-100%, -50%)",
    right: "translate(0, -50%)",
  };

  return (
    <span ref={triggerRef} className="inline-flex">
      {children}
      {mounted && toast && coords &&
        createPortal(
          <span
            className="fixed z-[200] pointer-events-none"
            style={{ top: coords.top, left: coords.left, transform: transformBySide[side] }}
          >
            <TransientBadge toast={toast} />
          </span>,
          document.body
        )}
    </span>
  );
}

