"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GUEST_ID_KEY, TEST_MODE_KEY } from "@/lib/guestId";

type UrlType = "http" | "tel" | "mailto" | "sms";

function getUrlType(url: string): UrlType | null {
  try {
    const { protocol } = new URL(url);
    if (protocol === "http:" || protocol === "https:") return "http";
    if (protocol === "tel:") return "tel";
    if (protocol === "mailto:") return "mailto";
    if (protocol === "sms:") return "sms";
    return null;
  } catch {
    return null;
  }
}

const TYPE_COPY: Record<UrlType, { heading: string; sub: string }> = {
  http: {
    heading: "Redirecting you to an external site…",
    sub: "You are leaving TrialChat.",
  },
  tel: {
    heading: "Opening your phone app…",
    sub: "You are leaving TrialChat.",
  },
  mailto: {
    heading: "Opening your email app…",
    sub: "You are leaving TrialChat.",
  },
  sms: {
    heading: "Opening your messages app…",
    sub: "You are leaving TrialChat.",
  },
};

function TypeIcon({ type }: { type: UrlType }) {
  if (type === "tel") {
    return (
      <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    );
  }
  if (type === "sms") {
    return (
      <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    );
  }
  if (type === "mailto") {
    return (
      <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    );
  }
  // http / https
  return (
    <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function RedirectContent() {
  const params = useSearchParams();
  const to = params.get("to") ?? "";
  const metaRaw = params.get("meta") ?? "{}";
  // Sign-in is not supported; all users are treated as guests.
  const isLoaded = true;
  const user = null as { id: string } | null;

  const urlType = to ? getUrlType(to) : null;
  const copy = urlType ? TYPE_COPY[urlType] : TYPE_COPY.http;

  const [isError, setIsError] = useState(false);
  const didTrackRef = useRef(false);

  useEffect(() => {
    if (didTrackRef.current) return;
    if (!isLoaded) return;

    if (!to || !urlType) {
      setIsError(true);
      return;
    }

    didTrackRef.current = true;

    let cancelled = false;

    const run = async () => {
      let meta: Record<string, unknown> = {};
      try { meta = JSON.parse(metaRaw); } catch { /* ignore */ }

      // Enrich meta with frontend context when fields are absent:
      // - role / intent from intake localStorage (set during onboarding)
      // - ref_page from document.referrer (where the user came from)
      try {
        const stored = localStorage.getItem("intake_data");
        if (stored) {
          const intake = JSON.parse(stored) as Record<string, unknown>;
          if (!meta.role && intake.role)     meta.role   = intake.role;
          if (!meta.intent && intake.intent) meta.intent = intake.intent;
        }
      } catch { /* ignore */ }

      if (!meta.ref_page && document.referrer) {
        try {
          meta.ref_page = new URL(document.referrer).pathname;
        } catch { /* ignore */ }
      }

      if (!meta.user_id) {
        const currentUserId = user?.id ?? (() => {
          try {
            return localStorage.getItem(GUEST_ID_KEY);
          } catch {
            return null;
          }
        })();

        if (currentUserId) {
          meta.user_id = currentUserId;
        }
      }

      // Tag as test data if the app is currently in test mode (?test=true),
      // unless the caller already set is_test explicitly.
      if (meta.is_test === undefined) {
        try {
          meta.is_test = localStorage.getItem(TEST_MODE_KEY) === "1";
        } catch {
          meta.is_test = false;
        }
      }

      try {
        await fetch("/api/track-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: to, url_type: urlType, meta }),
        });
      } catch {
        // Tracking failure must never block the redirect
      }

      if (!cancelled) {
        window.location.href = to;
      }
    };

    run();
    return () => { cancelled = true; };
  }, [isLoaded, metaRaw, to, urlType, user?.id]);

  if (isError || !to || !urlType) {
    return (
      <div className="text-center space-y-3">
        <p className="text-slate-500 text-sm">Invalid or missing destination URL.</p>
        <Link href="/" className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-700">
          Return to TrialChat
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 text-center max-w-xs mx-auto px-6">

      {/* Spinner + icon */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        {/* Outer spinning ring */}
        <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="36" stroke="rgb(203 213 225)" strokeWidth="2" />
          <path
            d="M40 4 A36 36 0 0 1 76 40"
            stroke="rgb(59 130 246)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        {/* Center icon */}
        <div className="relative z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
          <TypeIcon type={urlType} />
        </div>
      </div>

      {/* Text */}
      <div className="space-y-2">
        <h1 className="text-base font-semibold text-slate-700 leading-snug">
          {copy.heading}
        </h1>
        <p className="text-sm text-slate-500">{copy.sub}</p>
      </div>

      {/* Destination hint */}
      <div className="w-full rounded-xl border border-slate-200 bg-white/80 shadow-sm px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Destination</p>
        <p className="text-xs text-slate-500 font-mono truncate">{to}</p>
      </div>

      {/* Fallback */}
      <p className="text-xs text-slate-400">
        If you are not redirected automatically,{" "}
        <a
          href={to}
          className="text-blue-600 underline underline-offset-2 hover:text-blue-700 transition-colors"
        >
          click here
        </a>
        .
      </p>
    </div>
  );
}

export default function RedirectPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient — matches landing light mode */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-white pointer-events-none" />
      {/* Subtle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full">
        <Suspense
          fallback={
            <div className="flex items-center justify-center gap-3 text-slate-400 text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
              Loading…
            </div>
          }
        >
          <RedirectContent />
        </Suspense>
      </div>

      {/* Branding */}
      <div className="absolute bottom-8 text-center">
        <p className="text-[10px] text-slate-400 font-mono tracking-widest">
          TRIALCHAT · SECURE REDIRECT
        </p>
      </div>
    </div>
  );
}
