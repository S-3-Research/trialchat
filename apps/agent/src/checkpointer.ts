import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

/**
 * Thread/state persistence for the agent.
 *
 * - If `DATABASE_URL` is set, checkpoints are stored in Postgres so
 *   conversations survive server restarts and can be resumed from any
 *   process (needed once we run more than one agent instance).
 * - Otherwise falls back to an in-memory saver (dev convenience only —
 *   state is lost on restart), matching the previous default behavior of
 *   `langgraphjs dev`.
 *
 * `setup()` creates/migrates the required tables and is safe to call
 * every time the process starts (it's idempotent).
 */
let cached: Promise<BaseCheckpointSaver> | null = null;

export function getCheckpointer(): Promise<BaseCheckpointSaver> {
  if (cached) return cached;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.warn(
      "[checkpointer] DATABASE_URL not set — using in-memory checkpointer. " +
        "Conversations will NOT survive a server restart."
    );
    cached = Promise.resolve(new MemorySaver());
    return cached;
  }

  cached = (async () => {
    const saver = PostgresSaver.fromConnString(databaseUrl);
    await saver.setup();
    console.log("[checkpointer] Using Postgres-backed checkpointer.");
    return saver;
  })();

  return cached;
}
