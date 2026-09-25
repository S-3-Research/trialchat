/**
 * guestId.ts — shared helpers for guest user ID + test-mode flag.
 *
 * Test mode is triggered by visiting any trial-chat URL with `?test=true`
 * (e.g. https://igc-trialchat.vercel.app/trial-chat?test=true). Once set,
 * it is persisted in localStorage so it survives navigation/reloads until
 * the user explicitly exits test mode (banner "Exit" button, or `?test=false`).
 *
 * While in test mode:
 *  - the guest user id is generated with a `test_` prefix instead of `guest_`
 *  - referral link click tracking is tagged with `is_test: true`
 */

export const TEST_MODE_KEY = "trialchat_is_test";
export const GUEST_ID_KEY = "chatkit_guest_user_id";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Reads current test-mode flag from localStorage.
 *
 * Always reports test mode as on outside of a *real* production deploy —
 * local dev (`next dev` / Docker) and Vercel preview branches alike (both
 * build with `NODE_ENV=production`, so that var alone can't tell a
 * preview branch apart from the real thing; `NEXT_PUBLIC_VERCEL_ENV` can
 * — see next.config.ts). Reuses this same is_test mechanism instead of a
 * separate dev-mode/dev-database setup, so non-production runs never
 * write "real" (non-test) analytics rows by accident. Only an actual
 * production deploy falls through to the real localStorage-backed toggle
 * below.
 */
export function isTestMode(): boolean {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV !== "production") return true;
  if (!isBrowser()) return false;
  return localStorage.getItem(TEST_MODE_KEY) === "1";
}

/**
 * Enables test mode. If mode is actually changing (off -> on), the existing
 * guest user id is discarded so a fresh `test_` id gets generated on next use.
 */
export function enableTestMode(): void {
  if (!isBrowser()) return;
  const wasTest = isTestMode();
  localStorage.setItem(TEST_MODE_KEY, "1");
  if (!wasTest) {
    localStorage.removeItem(GUEST_ID_KEY);
  }
}

/**
 * Disables test mode. If mode is actually changing (on -> off), the existing
 * guest user id is discarded so a fresh `guest_` id gets generated on next use.
 */
export function disableTestMode(): void {
  if (!isBrowser()) return;
  const wasTest = isTestMode();
  localStorage.removeItem(TEST_MODE_KEY);
  if (wasTest) {
    localStorage.removeItem(GUEST_ID_KEY);
  }
}

/**
 * Reads the `test` query param (if present) and syncs test-mode state.
 * - `?test=true` → enable
 * - `?test=false` → disable
 * - absent → no change
 * Returns the resulting test-mode state.
 */
export function syncTestModeFromParam(testParam: string | null): boolean {
  if (testParam === "true") {
    enableTestMode();
  } else if (testParam === "false") {
    disableTestMode();
  }
  return isTestMode();
}

function generateId(prefix: "guest" | "test"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gets the stable guest user id from localStorage, generating one if absent.
 * The prefix (`guest_` vs `test_`) is derived from the current test-mode flag.
 * If an existing id's prefix doesn't match the current mode, a new id is
 * generated (this happens automatically on mode transitions via
 * enable/disableTestMode, which clear the stored id).
 */
export function getOrCreateGuestUserId(): string {
  if (!isBrowser()) return generateId("guest");

  const testMode = isTestMode();
  const prefix: "guest" | "test" = testMode ? "test" : "guest";

  let guestUserId = localStorage.getItem(GUEST_ID_KEY);
  const expectedPrefix = `${prefix}_`;
  if (!guestUserId || !guestUserId.startsWith(expectedPrefix)) {
    guestUserId = generateId(prefix);
    localStorage.setItem(GUEST_ID_KEY, guestUserId);
  }
  return guestUserId;
}
