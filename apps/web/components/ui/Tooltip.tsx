"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Fast-appearing tooltip rendered into a `document.body` portal — avoids
 * being clipped by any `overflow-hidden` ancestor (the chat/trial-panel
 * chrome uses `overflow-hidden` extensively for its rounded-corner/width
 * animations, which silently clipped the previous inline-positioned
 * version). Position is computed from the trigger's real bounding box on
 * open and on scroll/resize, so it always lands next to the trigger
 * regardless of which scroll container it's inside.
 *
 * Visually matches the app's existing floating-menu language (see the
 * "Ask TrialChat" dropdown in TrialCard.tsx) — a white/slate-900 card
 * with a hairline border and soft shadow — rather than a stark solid
 * black bubble, so it reads as part of the same design system in both
 * light and dark mode.
 */
export function Tooltip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: ReactNode;
  /** Which side of the trigger the tooltip prefers to appear on. */
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  const GAP = 8;

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let top = rect.bottom + GAP;
    let left = rect.left + rect.width / 2;
    if (side === "top") {
      top = rect.top - GAP;
    } else if (side === "left") {
      top = rect.top + rect.height / 2;
      left = rect.left - GAP;
    } else if (side === "right") {
      top = rect.top + rect.height / 2;
      left = rect.right + GAP;
    }
    setCoords({ top, left });
  };

  const scheduleOpen = () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => {
      updatePosition();
      setOpen(true);
    }, 150);
  };

  const closeNow = () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    setOpen(false);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const onReposition = () => updatePosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
  }, []);

  const transformBySide: Record<string, string> = {
    top: "translate(-50%, -100%)",
    bottom: "translate(-50%, 0)",
    left: "translate(-100%, -50%)",
    right: "translate(0, -50%)",
  };

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={scheduleOpen}
      onMouseLeave={closeNow}
      onFocus={scheduleOpen}
      onBlur={closeNow}
    >
      {children}
      {mounted && open && coords &&
        createPortal(
          // Outer span owns the fixed positioning transform (translate to
          // anchor against the trigger); inner span owns the entrance
          // animation's own transform (scale). Animating `transform` on
          // the same element used for position would stomp the position
          // transform for the animation's duration, so they're split
          // across two nested elements instead.
          <span
            className="fixed z-[200] pointer-events-none"
            style={{
              top: coords.top,
              left: coords.left,
              transform: transformBySide[side],
            }}
          >
            <span
              role="tooltip"
              className="block whitespace-nowrap rounded-lg border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-[0_12px_32px_-8px_rgba(30,41,59,0.25)] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)] animate-tooltip-in"
            >
              {label}
            </span>
          </span>,
          document.body
        )}
    </span>
  );
}

