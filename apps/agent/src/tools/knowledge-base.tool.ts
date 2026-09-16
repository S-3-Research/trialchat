import { z } from "zod";
import OpenAI from "openai";
import type { AgentTool } from "./registry.js";

/**
 * Searches our internal TrialChat knowledge base via OpenAI's standalone
 * Vector Store Search API (`client.vectorStores.search`) — a plain
 * documented REST endpoint, independent of the chat/Responses model call.
 * This makes it a normal function tool: no dependency on the Responses
 * API's `file_search` built-in tool (which only OpenAI can execute
 * server-side, and whose results the current assistant-ui version can't
 * render — see the note on `AgentTool` in `registry.ts`).
 *
 * Requires `OPENAI_VECTOR_STORE_ID` (and `OPENAI_API_KEY`) in apps/agent's
 * environment. If unset, `registry.ts` drops this tool from presets
 * entirely rather than calling it with an empty store id.
 */
const knowledgeBaseSchema = z.object({
  query: z.string().describe("The question or topic to search the knowledge base for."),
});

type KnowledgeBaseArgs = z.infer<typeof knowledgeBaseSchema>;

let client: OpenAI | undefined;
function getClient(): OpenAI {
  client ??= new OpenAI();
  return client;
}

async function searchKnowledgeBase({ query }: KnowledgeBaseArgs) {
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
  if (!vectorStoreId) {
    return { success: false, error: "Knowledge base is not configured." };
  }

  try {
    const response = await getClient().vectorStores.search(vectorStoreId, {
      query,
      max_num_results: 8,
    });

    const results = response.data.map((r) => ({
      filename: r.filename,
      score: r.score,
      snippet: r.content
        .map((c) => c.text)
        .join(" ")
        .slice(0, 500),
    }));

    return {
      success: true,
      count: results.length,
      results,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Knowledge base search failed.",
    };
  }
}

export const knowledgeBaseTool: AgentTool<KnowledgeBaseArgs> = {
  name: "knowledge_base",
  activityLabel: "Searching knowledge base",
  description:
    "Search the internal TrialChat knowledge base for general clinical-trial and condition information (not for finding specific trials — use trial_search for that).",
  schema: knowledgeBaseSchema,
  execute: searchKnowledgeBase,
};
