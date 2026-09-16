/**
 * One-off diagnostic script: calls the raw OpenAI Responses API directly
 * (bypassing LangChain entirely) with `stream: true` and
 * `reasoning: { summary: "concise" }`, and prints every raw SSE event type
 * it receives — specifically whether any `response.reasoning_summary_*`
 * events ever arrive.
 *
 * Why bypass LangChain: `@langchain/openai`'s converter (dist/converters/
 * responses.js) already correctly handles `response.reasoning_summary_text
 * .delta` etc. and turns them into streamed `reasoning` content parts (see
 * the reasoning-stream investigation in this session) — so if reasoning
 * summaries aren't showing up in the app, the fastest way to tell whether
 * that's an OpenAI/account/model issue vs. an app-code issue is to look at
 * the *raw* event stream directly, with nothing in between.
 *
 * Usage:
 *   cd apps/agent
 *   npx tsx scripts/debug-reasoning-stream.ts [model]
 *
 * (defaults to gpt-5-mini if no model arg given)
 */
import OpenAI from "openai";

const model = process.argv[2] ?? "gpt-5-mini";

async function main() {
  const client = new OpenAI();

  console.log(`\n=== Requesting a Responses API stream from "${model}" ===\n`);

  const stream = await client.responses.create({
    model,
    input: [
      {
        role: "user",
        content:
          "Briefly explain, in 2-3 sentences, why the sky is blue. Think it through step by step first.",
      },
    ],
    reasoning: { summary: "concise" },
    stream: true,
  });

  const eventCounts = new Map<string, number>();
  let reasoningTextSeen = "";
  let sawAnyReasoningEvent = false;

  for await (const event of stream) {
    const type = (event as { type: string }).type;
    eventCounts.set(type, (eventCounts.get(type) ?? 0) + 1);

    if (type.startsWith("response.reasoning_summary")) {
      sawAnyReasoningEvent = true;
      const delta = (event as { delta?: string }).delta;
      if (delta) {
        reasoningTextSeen += delta;
        process.stdout.write(delta);
      }
    }
  }

  console.log("\n\n=== Event type counts ===");
  for (const [type, count] of eventCounts) {
    console.log(`  ${type}: ${count}`);
  }

  console.log("\n=== Verdict ===");
  if (sawAnyReasoningEvent) {
    console.log(
      `✅ Reasoning summary events WERE received (${reasoningTextSeen.length} chars of summary text). The app-side code path should work — if it still doesn't show up in the UI, the bug is in our app, not OpenAI.`
    );
  } else {
    console.log(
      "❌ NO reasoning_summary_* events were received at all, despite requesting `reasoning: { summary: \"concise\" }`.\n" +
        "This points to an OpenAI/account/model-side limitation (e.g. organization not verified for reasoning summaries on this model, or the model doesn't support summaries), NOT a bug in our LangChain/frontend code."
    );
  }
}

main().catch((err) => {
  console.error("\n=== Request failed ===");
  console.error(err);
  process.exit(1);
});
