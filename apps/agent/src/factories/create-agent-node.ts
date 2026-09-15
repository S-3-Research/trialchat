import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool as makeLangChainTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import type { AgentStateType } from "../state.js";
import type { AgentTool } from "../tools/registry.js";

/**
 * Config for a node built around `model + prompt + tools[]`. Every
 * `AgentTool` is a "function" tool we implement and execute ourselves (see
 * `tools/*.tool.ts`) — including capabilities backed by an OpenAI API under
 * the hood, like `knowledge_base` (OpenAI vector store search) and
 * `web_search` (a standalone Responses API call with the `web_search`
 * built-in tool). Wrapping them as plain function tools — instead of
 * passing OpenAI's hosted Responses API tool definitions straight through
 * to the model — means every tool call/result round-trips through the
 * exact same LangChain tool_call/ToolMessage protocol as `trial_search`,
 * which is what assistant-ui's tool-call UI (`tools.by_name` in
 * `thread.tsx`/`tool-ui.tsx`) actually understands. (An earlier version of
 * this factory tried to pass hosted tool configs straight to the model and
 * reconstruct synthetic tool_call/ToolMessage pairs from
 * `additional_kwargs.tool_outputs` afterwards — that data is
 * undocumented/version-fragile and the assistant-ui version in this repo
 * doesn't render it at all, so it never worked reliably. Don't reintroduce
 * that path; if a use case truly needs an OpenAI-hosted tool passed
 * directly to the model, it needs new frontend support first.)
 */
export type AgentNodeConfig = {
  model?: string;
  temperature?: number;
  prompt: string;
  tools?: AgentTool[];
};

const MAX_TOOL_ITERATIONS = 4;

export function createAgentNode(config: AgentNodeConfig) {
  const agentTools = config.tools ?? [];

  const langChainTools = agentTools.map((t) =>
    makeLangChainTool(t.execute, {
      name: t.name,
      description: t.description,
      schema: t.schema,
    })
  );

  const base = new ChatOpenAI({
    model: config.model ?? "gpt-4o-mini",
    temperature: config.temperature ?? 0.3,
  });
  const model = langChainTools.length ? base.bindTools(langChainTools) : base;

  const toolsByName = new Map(langChainTools.map((t) => [t.name, t]));

  return async function agentNode(state: AgentStateType) {
    const messages = [
      { role: "system" as const, content: config.prompt },
      ...state.messages,
    ];

    let response = (await model.invoke(messages)) as AIMessage;
    const newMessages: (AIMessage | ToolMessage)[] = [response];

    let iterations = 0;
    while (response.tool_calls?.length && iterations < MAX_TOOL_ITERATIONS) {
      iterations += 1;
      const toolMessages = await Promise.all(
        response.tool_calls.map(async (call) => {
          const t = toolsByName.get(call.name);
          if (!t) {
            return new ToolMessage({
              tool_call_id: call.id!,
              content: `Unknown tool: ${call.name}`,
            });
          }
          return (await t.invoke(call)) as ToolMessage;
        })
      );
      newMessages.push(...toolMessages);

      response = (await model.invoke([...messages, ...newMessages])) as AIMessage;
      newMessages.push(response);
    }

    return { messages: newMessages };
  };
}

