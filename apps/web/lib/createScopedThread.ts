import { AGENT_ASSISTANT_ID, createAgentClient } from "./agentClient";
import { getOrCreateGuestUserId } from "./guestId";
import { createTrialScope } from "./bookmarks";
import type { TrialSnapshot } from "@acadia/shared-types";

export async function createScopedThread(type: "bookmark_full_snapshot" | "bookmark_picked_snapshot", trialIds: string[], title: string, trials: TrialSnapshot[] = [], initialPrompt = title) {
  // Capture before the first asynchronous step. Live bookmarks never enter a run.
  const contextScope = createTrialScope(type, trialIds, trials);
  const client = createAgentClient();
  // State writes before the first run require a graph association.
  const thread = await client.threads.create({ graphId: AGENT_ASSISTANT_ID, metadata: { userId: getOrCreateGuestUserId(), title, initialPrompt } });
  try {
    await client.threads.updateState(thread.thread_id, { values: { contextScope } });
  } catch (error) {
    await client.threads.delete(thread.thread_id).catch(() => undefined);
    throw error;
  }
  return thread.thread_id;
}
