import type { StartScreenPrompt } from "@openai/chatkit";

/** StartScreenPrompt extended with a compact mobile-friendly label/prompt. */
export type ExtendedStartScreenPrompt = StartScreenPrompt & {
  /** Short version of label and prompt, used on mobile screens (≤768px). */
  short: string;
};

/**
 * Resolves prompts for the current screen size.
 * - On mobile: `label` and `prompt` are replaced with `short`.
 * - Always strips `short` before returning to stay compatible with chatkit.
 */
export const resolvePrompts = (
  prompts: ExtendedStartScreenPrompt[],
  isMobile: boolean
): StartScreenPrompt[] =>
  prompts.map(({ short, label, prompt, ...rest }) => ({
    label: isMobile ? short : label,
    prompt: prompt,
    ...rest,
  }));
