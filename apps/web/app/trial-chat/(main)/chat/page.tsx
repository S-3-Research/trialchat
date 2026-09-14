"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import App from "@/app/App";

function ChatPageInner() {
  const searchParams = useSearchParams();
  const skipIntake = searchParams.get("skip_intake") === "1";
  const autoOpenMatch = searchParams.get("open_match") === "1";

  return <App skipIntake={skipIntake} autoOpenMatch={autoOpenMatch} />;
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
