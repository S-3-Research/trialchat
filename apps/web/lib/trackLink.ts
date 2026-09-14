/**
 * trackLink.ts — frontend helper for building /r tracking redirect URLs.
 *
 * Usage:
 *   import { buildTrackedUrl } from "@/lib/trackLink";
 *
 *   <a href={buildTrackedUrl("https://clinicaltrials.gov/study/NCT123", {
 *     cta: "trial-enroll-btn",
 *     role: "caregiver",
 *     intent: "trial_matching",
 *     session_id: sessionId,
 *   })}>
 *     Enroll now
 *   </a>
 */

export interface LinkMeta {
  /** Label for the click-to-action source, e.g. "trial-card", "resource-link" */
  cta?: string;
  /** Current user role */
  role?: "user" | "caregiver" | "clinician";
  /** User intent captured during intake */
  intent?: "learn" | "match" | "trial_matching";
  /** Chat session user identifier, when available */
  user_id?: string;
  /** ChatKit / app session identifier */
  session_id?: string;
  /** Originating page pathname */
  ref_page?: string;
  /** Whether this click happened while the app was in test mode (?test=true) */
  is_test?: boolean;
  /** Allow arbitrary extension fields */
  [key: string]: unknown;
}

const EXTERNAL_RE = /^(https?:|tel:|mailto:)/i;

/**
 * Wraps an external URL in the /r tracking redirect.
 * Internal paths (no protocol) are returned unchanged.
 *
 * @example
 * buildTrackedUrl("https://clinicaltrials.gov/study/NCT123", { cta: "trial-card" })
 * // → "/r?to=https%3A%2F%2Fclinicaltrials.gov%2Fstudy%2FNCT123&meta=%7B%22cta%22%3A%22trial-card%22%7D"
 */
export function buildTrackedUrl(rawUrl: string, meta?: LinkMeta): string {
  if (!EXTERNAL_RE.test(rawUrl)) return rawUrl;

  const params = new URLSearchParams({ to: rawUrl });
  if (meta && Object.keys(meta).length > 0) {
    params.set("meta", JSON.stringify(meta));
  }
  return `/r?${params.toString()}`;
}
