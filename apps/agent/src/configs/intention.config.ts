export const INTENTION_LABELS = ["knowledge", "trial_matching", "other"] as const;

/**
 * Classifies the user's latest message so `graph.ts` can route to the
 * matching specialist node (`knowledge`, `api_agent`, or `other_questions`).
 */
export const intentionConfig = {
  model: process.env.INTENTION_MODEL ?? "gpt-4o-mini",
  temperature: 0,
  labels: INTENTION_LABELS,
  stateKey: "intent" as const,
  systemPrompt: `Classify the user's latest message into exactly one category:
- "knowledge": general questions about clinical trials, conditions, or the trial process that do NOT require searching for specific trials.
- "trial_matching": the user wants to find, browse, or check for specific clinical trials matching their situation (condition, location, age, etc.).
- "other": anything else (greetings, small talk, unrelated questions).`,
};
