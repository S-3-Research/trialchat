/**
 * Fetch thread messages from the ChatKit API.
 *
 * ChatKit renders in a cross-origin iframe — we cannot access response text
 * from the client. Instead we capture the thread_id (from chatkit.thread.change)
 * and query the ChatKit API server-side to retrieve conversation items.
 *
 * POST /api/thread-messages  { thread_id: string }
 * → { messages: Array<{ role: string; content: string }> }
 */

export const runtime = "edge";

const OPENAI_API_BASE = "https://api.openai.com";

export async function POST(request: Request): Promise<Response> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return Response.json({ error: "Missing OpenAI API Key" }, { status: 500 });
    }

    const { thread_id } = (await request.json()) as { thread_id?: string };
    if (!thread_id) {
      return Response.json({ error: "thread_id is required" }, { status: 400 });
    }

    const messages = await fetchThreadMessages(openaiApiKey, thread_id);
    return Response.json({ messages });
  } catch (err) {
    console.error("[thread-messages] Error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error", messages: [] },
      { status: 500 },
    );
  }
}

// ─── Types ──────────────────────────────────────────────────────────────

interface ThreadMessage {
  role: string;
  content: string;
  isWidget?: boolean;
}

// ─── Fetch ──────────────────────────────────────────────────────────────

async function fetchThreadMessages(apiKey: string, threadId: string): Promise<ThreadMessage[]> {
  const url = `${OPENAI_API_BASE}/v1/chatkit/threads/${encodeURIComponent(threadId)}/items?order=asc&limit=100`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "chatkit_beta=v1",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.log(`[thread-messages] API failed (${res.status}):`, text.slice(0, 500));
    return [];
  }

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = data?.data || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log(`[thread-messages] ${items.length} items, types: [${items.map((i: any) => i.type).join(", ")}]`);

  return extractFromChatkitItems(items);
}

// ─── Extraction ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromChatkitItems(items: any[]): ThreadMessage[] {
  const messages: ThreadMessage[] = [];

  for (const item of items) {
    const t = item.type || "";

    // Message items
    if (t.includes("message")) {
      const role = t.includes("user") ? "user" : "assistant";
      const text = extractText(item);
      if (text) { messages.push({ role, content: text }); continue; }
    }

    // Response items (may carry input / output)
    if (t.includes("response")) {
      for (const inp of asArray(item.input)) {
        const text = extractText(inp);
        if (text) messages.push({ role: "user", content: text });
      }
      for (const out of asArray(item.output)) {
        const text = extractText(out);
        if (text) messages.push({ role: "assistant", content: text });
      }
      const direct = extractText(item);
      if (direct && !messages.some((m) => m.content === direct)) {
        messages.push({ role: "assistant", content: direct });
      }
      continue;
    }

    // Widget items → walk the component tree for Text / Title nodes
    if (t === "chatkit.widget" && item.widget) {
      const text = extractWidgetText(item.widget);
      if (text) { messages.push({ role: "assistant", content: text, isWidget: true }); continue; }
    }

    // Fallback: any item with text-like fields
    const text = extractText(item);
    if (text) {
      messages.push({
        role: item.role || (t.includes("user") ? "user" : "assistant"),
        content: text,
      });
    }
  }

  return messages;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Extract plain text from a single item/message object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item;

  if (typeof item.text === "string") return item.text;
  if (typeof item.content === "string") return item.content;
  if (typeof item.value === "string") return item.value;
  if (typeof item.message === "string") return item.message;
  if (item.text?.value && typeof item.text.value === "string") return item.text.value;

  if (Array.isArray(item.content)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const joined = item.content.map((c: any) => {
      if (typeof c === "string") return c;
      if (c.type === "text" || c.type === "output_text" || c.type === "input_text")
        return c.text?.value || c.text || "";
      return "";
    }).filter(Boolean).join("\n");
    if (joined) return joined;
  }

  if (Array.isArray(item.output)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const joined = item.output.map((o: any) => extractText(o)).filter(Boolean).join("\n");
    if (joined) return joined;
  }

  return "";
}

/** Walk a ChatKit widget tree and collect all Text / Title / Subtitle values. */
function extractWidgetText(widgetData: string | object): string {
  try {
    const root = typeof widgetData === "string" ? JSON.parse(widgetData) : widgetData;
    const out: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (function walk(n: any) {
      if (!n || typeof n !== "object") return;
      if ((n.type === "Text" || n.type === "Title" || n.type === "Subtitle") && typeof n.value === "string")
        out.push(n.value);
      if (Array.isArray(n.children)) n.children.forEach(walk);
    })(root);
    return out.join(" ").trim();
  } catch { return ""; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: any): any[] { return v == null ? [] : Array.isArray(v) ? v : [v]; }
