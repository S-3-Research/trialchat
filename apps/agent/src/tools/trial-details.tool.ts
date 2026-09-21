import { z } from "zod";
import type { AgentTool } from "./registry.js";

const schema = z.object({ trialIds: z.array(z.string().regex(/^NCT\d{8}$/i)).min(1).max(10) });
export const trialDetailsTool: AgentTool<z.infer<typeof schema>> = {
  name: "trial_details",
  activityLabel: "Reading trial details",
  description: "Resolve up to 10 specific trial IDs from the saved conversation scope using current ClinicalTrials.gov records. Retrieve details only for trials relevant to the question; report missing data honestly.",
  schema,
  execute: async ({ trialIds }) => Promise.all([...new Set(trialIds)].map(async (id) => {
    try {
      const response = await fetch(`https://clinicaltrials.gov/api/v2/studies/${id.toUpperCase()}`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) return { id, error: `Registry returned ${response.status}` };
      const { protocolSection: p } = await response.json() as { protocolSection: { identificationModule?: { briefTitle?: string }; statusModule?: { overallStatus?: string }; designModule?: { phases?: string[] }; descriptionModule?: { briefSummary?: string }; eligibilityModule?: unknown; contactsLocationsModule?: { locations?: unknown[] } } };
      return { id, title: p.identificationModule?.briefTitle, status: p.statusModule?.overallStatus, phases: p.designModule?.phases, summary: p.descriptionModule?.briefSummary, eligibility: p.eligibilityModule, locations: p.contactsLocationsModule?.locations, source: `https://clinicaltrials.gov/study/${id}` };
    } catch { return { id, error: "Current details unavailable; retry later." }; }
  })),
};
