"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { disableTestMode, isTestMode, syncTestModeFromParam } from "@/lib/guestId";

function TestModeBannerInner() {
  const [show, setShow] = useState(false);
  const searchParams = useSearchParams();
  // useSearchParams() returns a new object on every client-side navigation
  // (e.g. clicking "New chat"), even when the `test` param itself hasn't
  // changed. Only re-sync/re-show the banner when the param's actual value
  // changes, so hiding the banner (handleExit, non-production) sticks across
  // in-app navigation instead of being clobbered by this effect re-running.
  const lastTestParamRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const testParam = searchParams.get("test");
    if (lastTestParamRef.current === testParam) return;
    lastTestParamRef.current = testParam;
    const active = syncTestModeFromParam(testParam);
    setShow(active);
  }, [searchParams]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = () => setShow(isTestMode());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Only a real production deploy has a persistent, localStorage-backed
  // test-mode flag to actually turn off (see isTestMode()'s doc comment).
  // Everywhere else (dev, Vercel preview branches) it's always on, so
  // there's nothing to persist — the button just hides the banner for
  // the current page session; a refresh naturally brings it back.
  const isRealProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

  const handleExit = useCallback(() => {
    if (!isRealProduction) {
      setShow(false);
      return;
    }
    disableTestMode();
    setShow(false);
    // Strip ?test=... from the URL if present and navigate there directly.
    // (Using router.replace() followed by window.location.reload() is racy:
    // reload() can fire before the client-side navigation has updated the
    // address bar, so the reload happens against the old URL — which still
    // has `?test=true` — and syncTestModeFromParam() re-enables test mode
    // right after we just disabled it.)
    const url = new URL(window.location.href);
    url.searchParams.delete("test");
    window.location.href = url.pathname + url.search;
  }, [isRealProduction]);

  if (!show) return null;

  return (
    <div className="flex-none w-full bg-amber-500 dark:bg-amber-600 text-amber-950 dark:text-amber-50 z-40">
      <div className="mx-auto max-w-7xl w-[95%] flex items-center justify-between gap-3 py-2 px-1">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-sm font-semibold tracking-wide">Test Mode</span>
          <span className="hidden sm:inline text-sm text-amber-900/80 dark:text-amber-100/80">— chat sessions and link clicks are tagged as test data</span>
        </div>
        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 text-xs font-medium text-amber-900/80 dark:text-amber-100/80 hover:text-amber-950 dark:hover:text-white transition-colors whitespace-nowrap underline underline-offset-2 decoration-amber-700/50 dark:decoration-amber-200/50 hover:decoration-amber-950 dark:hover:decoration-white"
        >
          {isRealProduction ? "Exit test mode" : "Hide"}
        </button>
      </div>
    </div>
  );
}

export default function TestModeBanner() {
  return (
    <Suspense fallback={null}>
      <TestModeBannerInner />
    </Suspense>
  );
}
