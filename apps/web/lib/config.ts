import { ColorScheme, ThemeOption } from "@openai/chatkit";
import { IntakeData } from "./types/intake";
import { ExtendedStartScreenPrompt } from "./types/prompts";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

// Default starter prompts (fallback for users without intake data)
export const DEFAULT_STARTER_PROMPTS: ExtendedStartScreenPrompt[] = [
  {
    label: "Can you explain what Alzheimer's disease is and why clinical trials are important?",
    prompt: "Can you explain what Alzheimer's disease is and why clinical trials are important?",
    short: "What is Alzheimer's & why do trials matter?",
    icon: "circle-question",
  },
  {
    label: "Find clinical trials that might be right for me?",
    prompt: "Find clinical trials that might be right for me?",
    short: "Find trials that fit me",
    icon: "search",
  },
  {
    label: "What are the symptoms of Alzheimer's disease, such as agitation?",
    prompt: "What are the symptoms of Alzheimer's disease, such as agitation?",
    short: "What are Alzheimer's symptoms?",
    icon: "notebook",
  },
];

// Starter prompts for user — trial matching
const USER_TRIAL_MATCHING_PROMPTS: ExtendedStartScreenPrompt[] = [
  {
    label: "I'd like to find clinical trials that match my health profile",
    prompt: "I'd like to find clinical trials that match my health profile",
    short: "Find trials matching my profile",
    icon: "search",
  },
  {
    label: "What are the eligibility criteria for Alzheimer's disease trials?",
    prompt: "What are the eligibility criteria for Alzheimer's disease trials?",
    short: "What are trial eligibility criteria?",
    icon: "notebook",
  },
  {
    label: "What are the symptoms of Alzheimer's disease, such as agitation?",
    prompt: "What are the symptoms of Alzheimer's disease, such as agitation?",
    short: "What are Alzheimer's symptoms?",
    icon: "circle-question",
  },
];

// Starter prompts for caregiver — trial matching
const CAREGIVER_TRIAL_MATCHING_PROMPTS: ExtendedStartScreenPrompt[] = [
  {
    label: "Help me find clinical trials suitable for someone I know",
    prompt: "Help me find clinical trials suitable for someone I know",
    short: "Find trials for someone I know",
    icon: "search",
  },
  {
    label: "What eligibility criteria should I know about for Alzheimer's disease trials?",
    prompt: "What eligibility criteria should I know about for Alzheimer's disease trials?",
    short: "What are trial eligibility criteria?",
    icon: "notebook",
  },
  {
    label: "What are the symptoms of Alzheimer's disease, such as agitation?",
    prompt: "What are the symptoms of Alzheimer's disease, such as agitation?",
    short: "What are Alzheimer's symptoms?",
    icon: "circle-question",
  },
];

// Starter prompts for user — learn about trials
const USER_LEARN_TRIALS_PROMPTS: ExtendedStartScreenPrompt[] = [
  {
    label: "Can you explain what Alzheimer's disease is and why clinical trials matter?",
    prompt: "Can you explain what Alzheimer's disease is and why clinical trials matter?",
    short: "Why do clinical trials matter?",
    icon: "circle-question",
  },
  {
    label: "What should I expect if I participate in a clinical trial?",
    prompt: "What should I expect if I participate in a clinical trial?",
    short: "What to expect in a trial?",
    icon: "notebook",
  },
  {
    label: "What are the symptoms of Alzheimer's disease, such as agitation?",
    prompt: "What are the symptoms of Alzheimer's disease, such as agitation?",
    short: "What are Alzheimer's symptoms?",
    icon: "search",
  },
];

// Starter prompts for caregiver — learn about trials
const CAREGIVER_LEARN_TRIALS_PROMPTS: ExtendedStartScreenPrompt[] = [
  {
    label: "Can you explain Alzheimer's disease and why clinical trials are important?",
    prompt: "Can you explain Alzheimer's disease and why clinical trials are important?",
    short: "Why are clinical trials important?",
    icon: "circle-question",
  },
  {
    label: "What happens when someone participates in a clinical trial?",
    prompt: "What happens when someone participates in a clinical trial?",
    short: "What happens in a clinical trial?",
    icon: "notebook",
  },
  {
    label: "What are the symptoms of Alzheimer's disease, such as agitation?",
    prompt: "What are the symptoms of Alzheimer's disease, such as agitation?",
    short: "What are Alzheimer's symptoms?",
    icon: "search",
  },
];

// Starter prompts for user — learn about Alzheimer's disease
const USER_LEARN_ALZHEIMER_PROMPTS: ExtendedStartScreenPrompt[] = [
  {
    label: "What are the latest research breakthroughs in Alzheimer's disease and related dementias (ADRD)?",
    prompt: "What are the latest research breakthroughs in Alzheimer's disease and related dementias (ADRD)?",
    short: "Latest ADRD research breakthroughs?",
    icon: "circle-question",
  },
  {
    label: "What causes ADRD, and can it be prevented or slowed down?",
    prompt: "What causes ADRD, and can it be prevented or slowed down?",
    short: "What causes ADRD?",
    icon: "notebook",
  },
  {
    label: "What are the symptoms of Alzheimer's disease, such as agitation?",
    prompt: "What are the symptoms of Alzheimer's disease, such as agitation?",
    short: "What are Alzheimer's symptoms?",
    icon: "search",
  },
];

// Starter prompts for caregiver — learn about Alzheimer's disease
const CAREGIVER_LEARN_ALZHEIMER_PROMPTS: ExtendedStartScreenPrompt[] = [
  {
    label: "What are the latest research breakthroughs in Alzheimer's disease and related dementias (ADRD)?",
    prompt: "What are the latest research breakthroughs in Alzheimer's disease and related dementias (ADRD)?",
    short: "Latest ADRD research breakthroughs?",
    icon: "circle-question",
  },
  {
    label: "What causes ADRD, and can it be prevented or slowed down?",
    prompt: "What causes ADRD, and can it be prevented or slowed down?",
    short: "What causes ADRD?",
    icon: "notebook",
  },
  {
    label: "What are the symptoms of Alzheimer's disease, such as agitation?",
    prompt: "What are the symptoms of Alzheimer's disease, such as agitation?",
    short: "What are Alzheimer's symptoms?",
    icon: "search",
  },
];

// Starter prompts for clinicians — learn about ADRD trials
const CLINICIAN_LEARN_TRIALS_PROMPTS: ExtendedStartScreenPrompt[] = [
  {
    label: "Explain common ADRD trial eligibility criteria",
    prompt: "Explain common ADRD trial eligibility criteria",
    short: "ADRD trial eligibility criteria",
    icon: "notebook",
  },
  {
    label: "What should clinicians know about risks and benefits of trials?",
    prompt: "What should clinicians know about risks and benefits of trials?",
    short: "Trial risks & benefits overview",
    icon: "circle-question",
  },
  {
    label: "How do I discuss clinical trials with patients?",
    prompt: "How do I discuss clinical trials with patients?",
    short: "Discussing trials with patients",
    icon: "search",
  },
];

// Starter prompts for clinicians — trial matching / patient pre-screen
const CLINICIAN_TRIAL_MATCHING_PROMPTS: ExtendedStartScreenPrompt[] = [
  {
    label: "Help me pre-screen a patient for ADRD trials",
    prompt: "Help me pre-screen a patient for ADRD trials",
    short: "Pre-screen a patient for ADRD trials",
    icon: "search",
  },
  {
    label: "What key eligibility factors matter most for ADRD trials?",
    prompt: "What key eligibility factors matter most for ADRD trials?",
    short: "Key ADRD eligibility factors",
    icon: "notebook",
  },
  {
    label: "Identify potential trials based on a basic patient profile",
    prompt: "Identify potential trials based on a basic patient profile",
    short: "Trials for a patient profile",
    icon: "circle-question",
  },
];

// Starter prompts for clinicians — learn about Alzheimer's disease
const CLINICIAN_LEARN_ALZHEIMER_PROMPTS: ExtendedStartScreenPrompt[] = [
  {
    label: "Summarize ADRD for clinical discussion",
    prompt: "Summarize ADRD for clinical discussion",
    short: "Summarize ADRD clinically",
    icon: "circle-question",
  },
  {
    label: "What are the stages of Alzheimer's disease?",
    prompt: "What are the stages of Alzheimer's disease?",
    short: "Stages of Alzheimer's disease",
    icon: "notebook",
  },
  {
    label: "What recent research updates are relevant for clinicians?",
    prompt: "What recent research updates are relevant for clinicians?",
    short: "Recent ADRD research updates",
    icon: "search",
  },
];

// Greetings based on intent and role
const GREETINGS = {
  trial_matching_user: "Welcome to TrialChat! I'm here to help you find clinical trials that match your needs. Let's get started!",
  trial_matching_caregiver: "Welcome to TrialChat! I'm here to help you find suitable clinical trials for someone you know. How can I assist?",
  learn_about_trials_user: "Welcome to TrialChat! I'm here to answer your questions about Alzheimer's disease and clinical trials. What would you like to learn?",
  learn_about_trials_caregiver: "Welcome to TrialChat! I'm here to help you learn about Alzheimer's disease clinical trials. What can I explain?",
  learn_about_alzheimer_user: "Welcome to TrialChat! I'm here to help you learn about Alzheimer's disease. What would you like to know?",
  learn_about_alzheimer_caregiver: "Welcome to TrialChat! I'm here to help you learn about Alzheimer's disease for someone you care for. What can I explain?",
  default: "Welcome to TrialChat! I'm here to help you navigate Alzheimer's disease clinical trials. How can I assist you today?",
  clinician_trial_matching: "Welcome to TrialChat. I can help you pre-screen a patient for potential ADRD clinical trial matches. Please provide non-identifying clinical details.",
  clinician_learn_about_trials: "I can help explain ADRD clinical trials, eligibility criteria, risks and benefits, and referral considerations in clinician-friendly language.",
  clinician_learn_about_alzheimer: "I can help summarize Alzheimer's disease and related dementias for clinical context, including progression, symptoms, and research updates.",
  clinician_default: "Welcome to TrialChat. I can help clinicians understand ADRD clinical trials, eligibility criteria, and support patient pre-screening. How can I assist?",
};

// Helper function to get starter prompts based on user preferences
export const getStarterPromptsForUser = (intakeData: IntakeData | null): ExtendedStartScreenPrompt[] => {
  if (!intakeData) {
    return DEFAULT_STARTER_PROMPTS;
  }

  const { intent, role } = intakeData;

  // Clinician role — use clinician-specific prompts regardless of intent
  if (role === 'clinician') {
    if (intent === 'learn_about_trials') return CLINICIAN_LEARN_TRIALS_PROMPTS;
    if (intent === 'trial_matching') return CLINICIAN_TRIAL_MATCHING_PROMPTS;
    if (intent === 'learn_about_alzheimer') return CLINICIAN_LEARN_ALZHEIMER_PROMPTS;
    return CLINICIAN_LEARN_TRIALS_PROMPTS; // default for clinician
  }

  // intent is the primary signal; null role falls back to user perspective
  if (intent === 'trial_matching') {
    return role === 'caregiver' ? CAREGIVER_TRIAL_MATCHING_PROMPTS : USER_TRIAL_MATCHING_PROMPTS;
  }
  if (intent === 'learn_about_trials') {
    return role === 'caregiver' ? CAREGIVER_LEARN_TRIALS_PROMPTS : USER_LEARN_TRIALS_PROMPTS;
  }
  if (intent === 'learn_about_alzheimer') {
    return role === 'caregiver' ? CAREGIVER_LEARN_ALZHEIMER_PROMPTS : USER_LEARN_ALZHEIMER_PROMPTS;
  }
  if (role === 'caregiver') {
    // Role signal without intent leans towards caregiver prompts
    return CAREGIVER_TRIAL_MATCHING_PROMPTS;
  }
  if (role === 'user') {
    // Role signal without intent leans towards user prompts
    return USER_TRIAL_MATCHING_PROMPTS;
  }
  // intent is null — no directional signal, use default
  return DEFAULT_STARTER_PROMPTS;
};

// Greetings for partial intake (intent known, role unknown)
const PARTIAL_GREETINGS = {
  trial_matching: "Welcome to TrialChat! I'm here to help you find clinical trials. Let's get started!",
  learn_about_trials: "Welcome to TrialChat! I'm here to answer your questions about Alzheimer's disease and clinical trials. What would you like to learn?",
  caregiver_only: "Welcome to TrialChat! I'm here to help you find information about Alzheimer's disease clinical trials for someone you know. How can I assist?",
};

// Helper function to get greeting based on user preferences
export const getGreetingForUser = (intakeData: IntakeData | null): string => {
  if (!intakeData) {
    return GREETINGS.default;
  }

  const { intent, role } = intakeData;

  // Clinician role — use clinician-specific greetings
  if (role === 'clinician') {
    if (intent === 'trial_matching') return GREETINGS.clinician_trial_matching;
    if (intent === 'learn_about_trials') return GREETINGS.clinician_learn_about_trials;
    if (intent === 'learn_about_alzheimer') return GREETINGS.clinician_learn_about_alzheimer;
    return GREETINGS.clinician_default;
  }

  // Both known — use specific greeting
  if (intent && role) {
    const key = `${intent}_${role}` as keyof typeof GREETINGS;
    return GREETINGS[key] || GREETINGS.default;
  }

  // Intent known, role unknown — intent-based greeting
  if (intent === 'trial_matching') return PARTIAL_GREETINGS.trial_matching;
  if (intent === 'learn_about_trials') return PARTIAL_GREETINGS.learn_about_trials;
  if (intent === 'learn_about_alzheimer') return "Welcome to TrialChat! I'm here to help you learn about Alzheimer's disease. What would you like to know?";

  // Role known (caregiver), intent unknown
  if (role === 'caregiver') return PARTIAL_GREETINGS.caregiver_only;

  // Everything null
  return GREETINGS.default;
};

export const PLACEHOLDER_INPUT = "Ask about clinical trials or Alzheimer's disease...";

// Keep these for backward compatibility
export const STARTER_PROMPTS = DEFAULT_STARTER_PROMPTS;
export const GREETING = GREETINGS.default;

export const getThemeConfig = (
  theme: ColorScheme,
  baseSize?: 14 | 15 | 16 | 17 | 18
): ThemeOption => ({
  color: {
    grayscale: {
      hue: 215,  // 蓝色调的灰度，更符合医疗科技感
      tint: 5,
      shade: theme === "dark" ? -1 : -3,
    },
    accent: {
      primary: theme === "dark" ? "#60a5fa" : "#2563eb",  // 蓝色主题色，匹配 TrialChat
      level: 2,  // 稍微增强对比度
    },
  },
  radius: "round",  // 圆润的边角，友好亲和
  density: "normal",  // 正常间距，适合老年人阅读
  ...(baseSize && {
    typography: {
      baseSize,
    },
  }),
  // chatkit.studio/playground to explore config options
});
