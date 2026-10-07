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
  systemPrompt: `Based on the conversation so far, write up to 3 short
follow-up messages the user could send next.

Each suggestion MUST be:
- Written in first person, as if the USER is typing it (e.g. "I'm 45 and
  live in Boston", "Can you check if it's still recruiting?", "What are
  the side effects?") — never third person, never an instruction to the
  assistant (NOT "Ask about trial location", NOT "Provide your age").
- Concrete and ready to send as-is with no placeholders or vague topics —
  the user should be able to tap it and send it unedited. If suggesting
  that the user share a detail (age, location, condition, etc.), invent a
  plausible concrete value for it rather than naming the category (e.g.
  "I'm 62 and have type 2 diabetes", not "Share your age and condition").
- Directly useful given what has already been discussed — do not repeat
  information the user already provided.

Keep each suggestion under 12 words.`,
};
