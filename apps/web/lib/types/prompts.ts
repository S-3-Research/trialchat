import type { StartScreenPrompt } from "@openai/chatkit";

/** StartScreenPrompt extended with a compact mobile-friendly label/prompt. */
export type ExtendedStartScreenPrompt = StartScreenPrompt & {
  /** Short version of label and prompt, used on mobile screens (≤768px). */
  short: string;
};

/**
 * Chatkit-independent starter prompt shape, used by the assistant-ui based
 * chat UI (components/assistant-ui/thread.tsx). Avoids importing types from
 * @openai/chatkit so the new UI has no dependency on the ChatKit package.
 */
export type ChatStarterPrompt = {
  label: string;
  prompt: string;
  icon?: string;
};

/** Converts ExtendedStartScreenPrompt[] (from lib/config.ts) to the
 * chatkit-independent shape used by the assistant-ui Thread component.
 * ChatKit's `prompt` field can be a plain string or a `UserMessageContent[]`
 * (rich content parts); assistant-ui's starter prompts only ever need plain
 * text, so non-string prompts are flattened to their text parts joined
 * together (falling back to an empty string if there's no text content). */
export const toChatStarterPrompts = (
  prompts: ExtendedStartScreenPrompt[],
  isMobile: boolean
): ChatStarterPrompt[] =>
  prompts.map(({ label, prompt, short, icon }) => ({
    label: isMobile ? short : label,
    prompt:
      typeof prompt === "string"
        ? prompt
        : prompt
            .map((part) => ("text" in part ? part.text : ""))
            .join(""),
    icon,
  }));

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
