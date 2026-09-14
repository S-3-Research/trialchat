"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { syncTestModeFromParam } from "@/lib/guestId";

/**
 * Reads the `?test=` query param on every /trial-chat/* route and syncs
 * test mode into localStorage. Rendered with no UI so it can be mounted
 * at a layout level above both the landing page and the (main) route
 * group, ensuring test mode is captured even if the user lands on a page
 * that doesn't render <TestModeBanner /> (e.g. the marketing landing page).
 */
function TestModeSyncInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const testParam = searchParams.get("test");
    syncTestModeFromParam(testParam);
  }, [searchParams]);

  return null;
}

export default function TestModeSync() {
  return (
    <Suspense fallback={null}>
      <TestModeSyncInner />
    </Suspense>
  );
}
