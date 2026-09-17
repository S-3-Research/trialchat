import { z } from "zod";
import type { AgentTool } from "./registry.js";

/**
 * Clinical trial search tool. Ported from the legacy ChatKit tool handler
 * (apps/web/app/api/tools/route.ts::handleGetTrials) — calls the same
 * external clinical-trials-matching API directly from the agent process.
 *
 * Requires CLINICAL_TRIALS_API_KEY in apps/agent's environment.
 */
const TRIALS_API_URL =
  "https://ltqkud1tu1.execute-api.us-west-2.amazonaws.com/Prod/get_trials";

const INTERVENTION_TYPES = [
  "drug",
  "device",
  "biological/vaccine",
  "procedure/surgery",
  "radiation",
  "behavioral",
  "genetic",
  "dietary_supplement",
  "combination_product",
  "diagnostic_test",
  "other",
] as const;

const PHASES = [
  "na",
  "early_phase1",
  "phase1",
  "phase2",
  "phase3",
  "phase4",
] as const;

const trialSearchSchema = z.object({
  age: z
    .number()
    .int()
    .min(0)
    .max(200)
    .optional()
    .describe("Age of the patient, must be between 0 and 200."),
  min_age: z
    .number()
    .int()
    .min(0)
    .max(200)
    .optional()
    .describe("Minimum age of the patient, must be between 0 and 200."),
  max_age: z
    .number()
    .int()
    .min(0)
    .max(200)
    .optional()
    .describe("Maximum age of the patient, must be between 0 and 200."),
  sex: z
    .enum(["male", "female", "all"])
    .optional()
    .describe("Sex of the patient, represented as an enumeration."),
  street: z.string().optional().describe("Street address of the location"),
  city: z.string().optional().describe("City of the location"),
  county: z.string().optional().describe("County of the location"),
  state: z.string().optional().describe("State or province of the location"),
  country: z.string().optional().describe("Country of the location"),
  zipcode: z.string().optional().describe("Postal code of the location"),
  lon: z.number().optional().describe("Longitude of the location"),
  lat: z.number().optional().describe("Latitude of the location"),
  conditions: z
    .array(z.string())
    .optional()
    .describe("List of medical conditions the patient has, e.g. ['Alzheimer Disease']"),
  pref_distance: z
    .number()
    .int()
    .optional()
    .describe("Preferred maximum distance (in miles) for clinical trials."),
  drive_duration: z
    .number()
    .optional()
    .describe(
      "Preferred maximum driving duration (in hours) to the clinical trial location."
    ),
  start_year: z
    .number()
    .int()
    .optional()
    .describe("Preferred start year for the clinical trial."),
  start_month: z
    .number()
    .int()
    .optional()
    .describe("Preferred start month for the clinical trial."),
  start_day: z
    .number()
    .int()
    .optional()
    .describe("Preferred start day for the clinical trial."),
  end_year: z
    .number()
    .int()
    .optional()
    .describe("Preferred end year for the clinical trial."),
  end_month: z
    .number()
    .int()
    .optional()
    .describe("Preferred end month for the clinical trial."),
  end_day: z
    .number()
    .int()
    .optional()
    .describe("Preferred end day for the clinical trial."),
  top_n: z
    .number()
    .int()
    .optional()
    .describe(
      "Number of top clinical trials to return based on the matching criteria, recommended 5-10."
    ),
  intervention_types: z
    .array(z.enum(INTERVENTION_TYPES))
    .optional()
    .describe("List of preferred intervention types for the clinical trials."),
  phases: z
    .array(z.enum(PHASES))
    .optional()
    .describe("List of preferred clinical trial phases."),
  page: z
    .number()
    .int()
    .optional()
    .describe("The page number for the clinical trial result to show."),
});

type TrialSearchArgs = z.infer<typeof trialSearchSchema>;

// The external API nests trial fields under `clinical_trial`, locations
// under `matched_locations[].facility_info.facility_location`, and match
// diagnostics under `reports`. Flatten this into the simple shape the web
// UI (apps/web/components/assistant-ui/tool-ui.tsx) renders.
type RawFacilityLocation = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

type RawMatchedLocation = {
  facility_info?: {
    facility_location?: RawFacilityLocation;
    facility_name?: string;
  };
};

type RawMatchReport = {
  result: boolean;
  filter_type: string;
  result_text: string;
};

type RawMatchedTrial = {
  clinical_trial?: {
    id?: string;
    title?: string;
    recruitment_status?: string;
    conditions?: string[];
    phases?: string[];
    intervention_types?: string[];
    eligibility_summary?: string;
    min_age?: number;
    max_age?: number;
    links?: string[];
  };
  matched_locations?: RawMatchedLocation[];
  reports?: RawMatchReport[];
  rank?: number;
};

function flattenTrial(raw: RawMatchedTrial) {
  const ct = raw.clinical_trial ?? {};
  const locations = (raw.matched_locations ?? [])
    .map((loc) => loc.facility_info?.facility_location)
    .filter((loc): loc is RawFacilityLocation => !!loc)
    .slice(0, 3)
    .map((loc) => ({
      city: loc.city ?? undefined,
      state: loc.state ?? undefined,
      country: loc.country ?? undefined,
    }));

  return {
    id: ct.id,
    title: ct.title,
    recruitment_status: ct.recruitment_status,
    conditions: ct.conditions,
    phases: ct.phases,
    intervention_types: ct.intervention_types,
    eligibility_summary: ct.eligibility_summary,
    min_age: ct.min_age,
    max_age: ct.max_age,
    links: ct.links,
    locations,
    reports: raw.reports,
    rank: raw.rank,
  };
}

/**
 * The external API embeds the true total count/page count in
 * `summary_report`'s free text (e.g. "...total 27 matched trial in our
 * database, total 6 pages.") rather than a structured field — parse it
 * out so the web app's Trial Panel can show an accurate count. See the
 * mirrored parser in apps/web/app/api/trial-search/route.ts.
 */
function parseTotalsFromSummary(summary: string | undefined): {
  total?: number;
  totalPages?: number;
} {
  if (!summary) return {};
  const totalMatch = summary.match(/total\s+(\d+)\s+matched trial/i);
  const pagesMatch = summary.match(/total\s+(\d+)\s+pages?/i);
  return {
    total: totalMatch ? Number(totalMatch[1]) : undefined,
    totalPages: pagesMatch ? Number(pagesMatch[1]) : undefined,
  };
}

async function searchTrials(args: TrialSearchArgs) {
  const apiKey = process.env.CLINICAL_TRIALS_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "Clinical trials API key not configured on the agent.",
    };
  }

  const requestBody: Record<string, unknown> = { ...args, page: args.page ?? 1 };

  try {
    const response = await fetch(TRIALS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Clinical trials API error: ${response.status}`,
        details: errorData,
      };
    }

    const data = (await response.json()) as {
      matched_trial?: RawMatchedTrial[];
      summary_report?: string;
    };
    const matchedTrials = (data.matched_trial ?? []).map(flattenTrial);
    const { total, totalPages } = parseTotalsFromSummary(data.summary_report);

    return {
      success: true,
      count: matchedTrials.length,
      trials: matchedTrials,
      total,
      totalPages,
      page: args.page ?? 1,
      summary:
        data.summary_report ?? `Found ${matchedTrials.length} matching trials`,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch clinical trials",
    };
  }
}

export const trialSearchTool: AgentTool<TrialSearchArgs> = {
  name: "trial_search",
  activityLabel: "Searching clinical trials",
  description:
    "Search for clinical trials matching patient criteria including age, sex, location, medical conditions, and preferences. Returns a list of matching trials with detailed information and match reports.",
  schema: trialSearchSchema,
  execute: searchTrials,
};
