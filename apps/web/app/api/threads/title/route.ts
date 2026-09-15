import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates a short thread title (~4-6 words) from the first user/assistant
 * exchange. Called by lib/threadListAdapter.ts's `generateTitle`, which runs
 * once per thread right after the first message round-trip.
 *
 * Deliberately a tiny, isolated route (rather than round-tripping through
 * the LangGraph agent) so title generation can't interfere with — or be
 * blocked by — the main chat graph/tool-calling loop.
 */
export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as {
      messages: { role: string; content: string }[];
    };

    const transcript = (messages ?? [])
      .slice(0, 4)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(0, 2000);

    if (!transcript.trim()) {
      return NextResponse.json({ title: "New Chat" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 20,
      messages: [
        {
          role: "system",
          content:
            "Generate a short chat title (3-6 words, no quotes, no punctuation at the end) " +
            "that summarizes what the user is asking about in this conversation excerpt. " +
            "Respond with the title only.",
        },
        { role: "user", content: transcript },
      ],
    });

    const title =
      completion.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") ||
      "New Chat";

    return NextResponse.json({ title });
  } catch (error) {
    console.error("[api/threads/title] error", error);
    return NextResponse.json({ title: "New Chat" });
  }
}
