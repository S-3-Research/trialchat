/** Starter prompts shared by the landing/intake configuration and chat UI. */
export type ChatStarterPrompt = {
  label: string;
  prompt: string;
  icon?: string;
};

export type ExtendedStartScreenPrompt = ChatStarterPrompt & {
  short: string;
};

export const toChatStarterPrompts = (
  prompts: ExtendedStartScreenPrompt[],
  isMobile: boolean
): ChatStarterPrompt[] =>
  prompts.map(({ label, prompt, short, icon }) => ({
    label: isMobile ? short : label,
    prompt,
    icon,
  }));
