import { toolPresets } from "../tools/registry.js";

/**
 * Fallback for messages that are neither knowledge questions nor trial
 * search requests (greetings, small talk, off-topic questions, etc.). No
 * tools needed.
 */
export const otherQuestionsConfig = {
  model: process.env.AGENT_MODEL ?? "gpt-5-mini",
  temperature: 0.5,
  prompt: `You are the Acadia Trial Chat assistant. The user's message is
unrelated to clinical trial knowledge or trial matching. Respond briefly and
helpfully, and gently steer the conversation back toward how you can help
with clinical trial information or finding trials.`,
  tools: toolPresets.none,
  activityLabel: "Thinking",
};
