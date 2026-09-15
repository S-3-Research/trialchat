import { z } from "zod";
import OpenAI from "openai";
import type { AgentTool } from "./registry.js";

/**
 * Searches the public web via a standalone OpenAI Responses API call using
 * the `web_search` built-in tool — issued from *this* function's own
 * `client.responses.create()` call, not passed through to the agent's main
 * chat model. Wrapping it this way (rather than binding `web_search` as a
 * Responses API tool directly on the main model) means the result comes
 * back as a normal function-tool return value, so it round-trips through
 * the standard LangChain tool_call/ToolMessage protocol just like
 * `trial_search` — see the note on `AgentTool` in `registry.ts` for why
 * that matters for the frontend tool-call UI.
 */
const webSearchSchema = z.object({
  query: z.string().describe("The question or topic to search the web for."),
});

type WebSearchArgs = z.infer<typeof webSearchSchema>;

let client: OpenAI | undefined;
function getClient(): OpenAI {
  client ??= new OpenAI();
  return client;
}

type UrlCitation = {
  type: "url_citation";
  url: string;
  title: string;
};

async function searchWeb({ query }: WebSearchArgs) {
  try {
    const response = await getClient().responses.create({
      model: process.env.WEB_SEARCH_MODEL ?? "gpt-4o-mini",
      input: query,
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
    });

    const sources: { url: string; title: string }[] = [];
    for (const item of response.output) {
      if (item.type !== "message") continue;
      for (const part of item.content) {
        if (part.type !== "output_text") continue;
        for (const annotation of part.annotations ?? []) {
          if ((annotation as UrlCitation).type === "url_citation") {
            const citation = annotation as UrlCitation;
            sources.push({ url: citation.url, title: citation.title });
          }
        }
      }
    }

    return {
      success: true,
      summary: response.output_text,
      count: sources.length,
      sources,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Web search failed.",
    };
  }
}

export const webSearchTool: AgentTool<WebSearchArgs> = {
  name: "web_search",
  description: "Search the public web for current information not in the knowledge base.",
  schema: webSearchSchema,
  execute: searchWeb,
};
