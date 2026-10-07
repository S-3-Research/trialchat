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

The Trial Panel's structured filters (condition, location/distance,
recruiting status, intervention type, sex, age) are the primary way users
refine results — chat is secondary. Bias your suggestions toward concrete
filter-refinement requests. Only suggest a pure knowledge/discussion
question (e.g. "What does Phase 2 mean?") when no sensible filter
refinement applies to the current context.

Each suggestion MUST be:
- Written in first person, as if the USER is typing it to the assistant
  (e.g. "Only show me recruiting trials", "Expand the distance to 50
  miles", "Just show Phase 3 trials") — never third person, never a
  description of an action (NOT "Narrow to recruiting trials only" as a
  label, NOT "Filter: Phase 3").
- Concrete and ready to send as-is with no placeholders — the user should
  be able to tap it and send it unedited.
- Directly useful given what has already been discussed — do not repeat
  a filter the user already applied.

Keep each suggestion under 10 words.`,
};
