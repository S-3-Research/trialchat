"use client";

import { useEffect, useState } from "react";
import { DEV_SESSION_KEY, DEV_PASSWORD_KEY } from "@/lib/devAuth";

/**
 * Client-side password gate for internal dev-only tools (dev-test,
 * dev-test/history, voice-test). Mirrors the AdminLogin pattern used for
 * the /admin dashboard, but posts to /api/dev-auth and stores its own
 * sessionStorage keys so it doesn't collide with the admin session.
 */
export default function DevGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(DEV_SESSION_KEY);
    setAuthed(stored === "true");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/dev-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem(DEV_SESSION_KEY, "true");
        sessionStorage.setItem(DEV_PASSWORD_KEY, password);
        setAuthed(true);
      } else {
        setError(data.error || "Incorrect password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authed === null) {
    return null;
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h1 className="mb-1 text-lg font-semibold text-gray-900">
            Dev Tools Access
          </h1>
          <p className="mb-4 text-sm text-gray-500">
            This page is restricted to internal development use.
          </p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          {error && (
            <p className="mb-3 text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Checking..." : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
