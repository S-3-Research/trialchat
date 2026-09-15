/**
 * Runs after every branch (knowledge / api_agent / other_questions) to
 * produce short follow-up prompts for the UI, written to `state.suggestions`.
 */
export const suggestionsConfig = {
  model: process.env.SUGGESTIONS_MODEL ?? "gpt-4o-mini",
  temperature: 0.3,
  maxSuggestions: 3,
  systemPrompt: `Based on the conversation so far, suggest up to 3 short,
natural follow-up questions or actions the user might want to take next.
Keep each suggestion under 10 words.`,
};
