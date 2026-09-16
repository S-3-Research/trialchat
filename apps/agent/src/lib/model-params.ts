/**
 * GPT-5 models (including gpt-5-mini, gpt-5-nano) only support the default
 * `temperature` (1) — passing any other value causes OpenAI to reject the
 * request with "Unsupported value: 'temperature' does not support 0.3 with
 * this model." Centralize the "should we even send temperature" check here
 * so every `new ChatOpenAI({...})` call site stays a one-liner and doesn't
 * need to special-case model families itself.
 */
export function supportsTemperature(model: string): boolean {
  return !/^gpt-5/i.test(model);
}

/**
 * Builds the `{ model, temperature? }` fields to spread into a
 * `ChatOpenAI`/`withStructuredOutput` constructor, omitting `temperature`
 * entirely for model families that reject a custom value.
 */
export function modelParams(model: string, temperature: number) {
  return supportsTemperature(model) ? { model, temperature } : { model };
}
