/**
 * Medical terminology corrections for voice input
 * Common misrecognitions and their corrections
 */

const MEDICAL_TERMS: Record<string, string> = {
  // Alzheimer's disease variations
  "alzheimers": "Alzheimer's",
  "alzheimer": "Alzheimer's",
  "alzheimers disease": "Alzheimer's disease",
  "alzheimer disease": "Alzheimer's disease",
  "old timers": "Alzheimer's",
  "old timers disease": "Alzheimer's disease",
  
  // Dementia variations
  "dimentia": "dementia",
  "demenshia": "dementia",
  "d mental": "dementia",
  
  // MCI (Mild Cognitive Impairment)
  "m c i": "MCI",
  "mild cognitive impairment": "MCI",
  
  // ADRD (Alzheimer's Disease and Related Dementias)
  "a d r d": "ADRD",
  
  // Other medical terms
  "parkinsons": "Parkinson's",
  "parkinson": "Parkinson's",
  "parkinsons disease": "Parkinson's disease",
  "lewy body": "Lewy body",
  "lewybody": "Lewy body",
  "vascular dementia": "vascular dementia",
  "frontotemporal": "frontotemporal",
  "cognitive decline": "cognitive decline",
  "memory loss": "memory loss",
  "clinical trial": "clinical trial",
  "clinical trials": "clinical trials",
  
  // Common trial-related terms
  "placebo": "placebo",
  "double blind": "double-blind",
  "randomized": "randomized",
  "enrollment": "enrollment",
  "eligibility": "eligibility",
  "participant": "participant",
  "caregiver": "caregiver",
};

/**
 * Corrects common medical terminology misrecognitions in voice input
 * @param text - The raw transcript from speech recognition
 * @returns Corrected text with proper medical terminology
 */
export function correctMedicalTerms(text: string): string {
  let corrected = text;
  
  // Sort by length (longest first) to avoid partial replacements
  const sortedTerms = Object.entries(MEDICAL_TERMS).sort(
    ([a], [b]) => b.length - a.length
  );
  
  for (const [wrong, right] of sortedTerms) {
    // Case-insensitive replacement, preserving sentence case
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    corrected = corrected.replace(regex, (match) => {
      // If the match starts with uppercase, capitalize the replacement
      if (match[0] === match[0].toUpperCase()) {
        return right.charAt(0).toUpperCase() + right.slice(1);
      }
      return right;
    });
  }
  
  return corrected;
}

/**
 * Adds a custom medical term to the correction dictionary
 * Useful for adding patient-specific or organization-specific terms
 */
export function addMedicalTerm(wrong: string, correct: string): void {
  MEDICAL_TERMS[wrong.toLowerCase()] = correct;
}

/**
 * Get all registered medical terms for reference
 */
export function getMedicalTerms(): Readonly<Record<string, string>> {
  return Object.freeze({ ...MEDICAL_TERMS });
}
