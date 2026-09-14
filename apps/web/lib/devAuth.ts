/**
 * lib/devAuth.ts — client-side helpers for the internal dev-tools password
 * gate (used by /trial-chat/dev-test, /trial-chat/dev-test/history and
 * /trial-chat/voice-test). Mirrors the pattern used for the admin panel,
 * but keyed off DEV_PASSWORD / /api/dev-auth instead of ADMIN_PASSWORD.
 */

export const DEV_SESSION_KEY = "dev_authed";
export const DEV_PASSWORD_KEY = "dev_password";

/** Reads the stored dev password from sessionStorage (empty string if unset/SSR). */
export function getStoredDevPassword(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(DEV_PASSWORD_KEY) ?? "";
}

/** Builds a headers object carrying the dev password, for use in fetch() calls. */
export function devAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    ...extra,
    "x-dev-password": getStoredDevPassword(),
  };
}
