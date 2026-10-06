/**
 * Runs after every branch (knowledge / api_agent / other_questions) to
 * produce short follow-up prompts for the UI, pushed as an explicit
 * Generative UI message (via `typedUi(config).push(...)`, see
 * `nodes/suggestions.ts`) bound to the preceding assistant message.
 */
export const suggestionsConfig = {
  model: process.env.SUGGESTIONS_MODEL ?? "gpt-5.4-mini",
  temperature: 0.3,
  maxSuggestions: 3,
  systemPrompt: `Based on the conversation so far, suggest up to 3 short,
natural follow-up actions the user might want to take next.

The Trial Panel's structured filters (condition, location/distance,
recruiting status, intervention type, sex, age) are the primary way users
refine results — chat is secondary. Bias your suggestions toward concrete
filter-refinement actions phrased as something the user would tell the
assistant to do, e.g. "Narrow to recruiting trials only", "Expand distance
to 50 miles", "Filter to Phase 3 trials", "Add intervention type: drug",
rather than open-ended knowledge questions. Only suggest a pure knowledge/
discussion question (e.g. "What does Phase 2 mean?") when no sensible
filter refinement applies to the current context. Keep each suggestion
under 8 words and phrased as an action/command, not a question.`,
};
