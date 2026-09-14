"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { disableTestMode, isTestMode, syncTestModeFromParam } from "@/lib/guestId";

function TestModeBannerInner() {
  const [show, setShow] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const testParam = searchParams.get("test");
    const active = syncTestModeFromParam(testParam);
    setShow(active);
  }, [searchParams]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = () => setShow(isTestMode());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleExit = useCallback(() => {
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
  }, []);

  if (!show) return null;

  return (
    <div className="relative z-30 flex items-center justify-center gap-3 bg-amber-500 text-amber-950 text-xs sm:text-sm font-medium px-4 py-2 shadow-sm">
      <span className="inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        Test mode is on — chat sessions and link clicks are tagged as test data.
      </span>
      <button
        onClick={handleExit}
        className="rounded-md bg-amber-950/10 hover:bg-amber-950/20 px-2.5 py-1 font-semibold transition-colors"
      >
        Exit test mode
      </button>
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
