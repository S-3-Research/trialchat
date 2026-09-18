import { SYSTEM_PROMPT } from "../prompts/system.js";
import { toolPresets } from "../tools/registry.js";

/**
 * Trial-matching specialist — bound to `trial_search` (our own API) plus
 * `web_search` for anything the trial API can't answer directly.
 */
export const apiAgentConfig = {
  model: process.env.AGENT_MODEL ?? "gpt-5.6-terra",
  temperature: 0.3,
  prompt:
    SYSTEM_PROMPT +
    `\n\nIf the trial-search context has no \`results\` but does have one or
more \`selectedTrials\` (the user pinned specific trial(s) from the Trial
Panel, shown as "Re: <title>" pills on their message), treat the user's
question as scoped ONLY to those pinned trial(s) — answer using just their
data, even if the question itself doesn't name them, instead of running a
new broad search.`,
  tools: toolPresets.trialMatching,
  activityLabel: "Finding matching trials",
  maxCallsPerTool: 1,
  includeActiveTrialSearchContext: true,
};
