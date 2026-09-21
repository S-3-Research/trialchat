import type { ThreadContextScope } from "@acadia/shared-types";

/** Extract attempted writes from state updates, runs, and bulk state updates. */
export function requestedScopes(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as Record<string, unknown>;
  const writes: unknown[] = [];
  for (const key of ["values", "input"]) {
    const value = body[key];
    if (value && typeof value === "object" && "contextScope" in value) writes.push((value as Record<string, unknown>).contextScope);
  }
  for (const key of ["supersteps", "updates"]) {
    if (Array.isArray(body[key])) for (const update of body[key]) writes.push(...requestedScopes(update));
  }
  return writes;
}
export function overwritesFrozenScope(saved: ThreadContextScope | undefined, writes: unknown[]): boolean {
  if (!saved || saved.type === "trial_search") return false;
  return writes.some((value) => {
    const next = value as Partial<Exclude<ThreadContextScope, { type: "trial_search" }>> | null;
    return !next || next.type !== saved.type || next.capturedAt !== saved.capturedAt || !Array.isArray(next.trialIds) || next.trialIds.length !== saved.trialIds.length || next.trialIds.some((id, index) => id !== saved.trialIds[index]);
  });
}
