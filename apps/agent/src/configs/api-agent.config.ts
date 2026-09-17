import { SYSTEM_PROMPT } from "../prompts/system.js";
import { toolPresets } from "../tools/registry.js";

/**
 * Trial-matching specialist — bound to `trial_search` (our own API) plus
 * `web_search` for anything the trial API can't answer directly.
 */
export const apiAgentConfig = {
  model: process.env.AGENT_MODEL ?? "gpt-5-mini",
  temperature: 0.3,
  prompt: SYSTEM_PROMPT,
  tools: toolPresets.trialMatching,
  activityLabel: "Finding matching trials",
  maxCallsPerTool: 1,
  includeActiveTrialSearchContext: true,
};
