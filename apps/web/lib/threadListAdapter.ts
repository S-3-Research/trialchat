import type { Client } from "@langchain/langgraph-sdk";
import type { RemoteThreadListAdapter } from "@assistant-ui/react";
import { createAssistantStream } from "assistant-stream";
import type { ThreadMessage } from "@assistant-ui/react";

/**
 * Bridges assistant-ui's multi-thread UI (New Chat / history sidebar) to
 * LangGraph Server's native thread storage — no extra database needed.
 *
 * - Thread metadata (title, ownership, archived flag) lives in each
 *   LangGraph thread's `metadata` field (see apps/agent's Postgres
 *   checkpointer, which persists this alongside conversation state).
 * - Threads are scoped per browser via `userId` (the guest id from
 *   lib/guestId.ts) so different visitors don't see each other's history.
 * - Title generation calls our own /api/threads/title route (OpenAI), then
 *   persists the result via `threads.update` — see that route for details.
 *
 * remoteId === externalId === the LangGraph thread_id throughout, per the
 * assistant-ui LangGraph docs recommendation (keeps ids aligned with what
 * `load`/`stream` in useLangGraphRuntime receive).
 */
export function createThreadListAdapter(
  client: Client,
  userId: string
): RemoteThreadListAdapter {
  return {
    async list() {
      const threads = await client.threads.search({
        metadata: { userId },
        limit: 100,
        sortBy: "updated_at",
        sortOrder: "desc",
      });

      return {
        threads: threads.map((t) => {
          const metadata = (t.metadata ?? {}) as {
            title?: string;
            archived?: boolean;
          };
          return {
            status: metadata.archived ? "archived" : "regular",
            remoteId: t.thread_id,
            externalId: t.thread_id,
            title: metadata.title,
            lastMessageAt: t.updated_at ? new Date(t.updated_at) : undefined,
          };
        }),
      };
    },

    async initialize() {
      const t = await client.threads.create({ metadata: { userId } });
      return { remoteId: t.thread_id, externalId: t.thread_id };
    },

    async rename(remoteId, title) {
      await client.threads.update(remoteId, { metadata: { title } });
    },

    async archive(remoteId) {
      await client.threads.update(remoteId, { metadata: { archived: true } });
    },

    async unarchive(remoteId) {
      await client.threads.update(remoteId, { metadata: { archived: false } });
    },

    async delete(remoteId) {
      await client.threads.delete(remoteId);
    },

    async fetch(remoteId) {
      const t = await client.threads.get(remoteId);
      const metadata = (t.metadata ?? {}) as {
        title?: string;
        archived?: boolean;
      };
      return {
        status: metadata.archived ? "archived" : "regular",
        remoteId: t.thread_id,
        externalId: t.thread_id,
        title: metadata.title,
        lastMessageAt: t.updated_at ? new Date(t.updated_at) : undefined,
      };
    },

    async generateTitle(remoteId, messages: readonly ThreadMessage[]) {
      return createAssistantStream(async (controller) => {
        try {
          const res = await fetch("/api/threads/title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: messages.map((m) => ({
                role: m.role,
                content: m.content
                  .filter((p) => p.type === "text")
                  .map((p) => (p as { text: string }).text)
                  .join(" "),
              })),
            }),
          });
          const { title } = (await res.json()) as { title?: string };
          const finalTitle = title?.trim() || "New Chat";

          await client.threads.update(remoteId, {
            metadata: { title: finalTitle },
          });
          controller.appendText(finalTitle);
        } catch (error) {
          console.error("[threadListAdapter] generateTitle failed:", error);
          controller.appendText("New Chat");
        }
      });
    },
  };
}
