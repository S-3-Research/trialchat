import { useEffect, useState } from "react";

/**
 * The chat surface can have up to 3 columns docked side-by-side: the chat
 * history sidebar, the chat itself, and the Trial Panel. Below the width
 * needed to show all 3 comfortably, we auto-collapse rather than let them
 * squeeze/overlap:
 *
 * - "full"    (>= FULL_BREAKPOINT, 1280px): all 3 columns can be docked
 *              at once — sidebar + chat + Trial Panel.
 * - "compact" (>= COMPACT_BREAKPOINT, 768px, < FULL_BREAKPOINT): only
 *              room for 2 columns — chat + at most ONE of
 *              {sidebar, Trial Panel} docked at a time. Opening one
 *              auto-closes the other ("自动退让" — see AssistantPanel.tsx's
 *              auto-collapse effects).
 * - "overlay" (< COMPACT_BREAKPOINT, 768px): only room for 1 column —
 *              chat alone; both the sidebar and Trial Panel become
 *              full/near-full-width overlays on top of it instead of
 *              docking (existing `isMobile` drawer/sheet behavior).
 */
export type LayoutTier = "full" | "compact" | "overlay";

const COMPACT_BREAKPOINT = 768;
const FULL_BREAKPOINT = 1280;

function computeTier(): LayoutTier {
  if (typeof window === "undefined") return "full";
  const w = window.innerWidth;
  if (w < COMPACT_BREAKPOINT) return "overlay";
  if (w < FULL_BREAKPOINT) return "compact";
  return "full";
}

/** Reactive 3-way layout tier, see {@link LayoutTier} for the breakpoints. */
export function useLayoutTier(): LayoutTier {
  const [tier, setTier] = useState<LayoutTier>(computeTier);

  useEffect(() => {
    const compactMq = window.matchMedia(`(min-width: ${COMPACT_BREAKPOINT}px)`);
    const fullMq = window.matchMedia(`(min-width: ${FULL_BREAKPOINT}px)`);
    const update = () => setTier(computeTier());
    update();
    compactMq.addEventListener("change", update);
    fullMq.addEventListener("change", update);
    return () => {
      compactMq.removeEventListener("change", update);
      fullMq.removeEventListener("change", update);
    };
  }, []);

  return tier;
}
