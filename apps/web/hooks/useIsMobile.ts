import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

const getIsMobile = () =>
  typeof window !== "undefined"
    ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
    : false;

/**
 * Returns true when the viewport width is ≤ 768px.
 * Reads matchMedia synchronously on first render to avoid a flash on mobile.
 * Updates reactively on viewport resize.
 */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    // Sync in case width changed between SSR and hydration
    setIsMobile(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
};
