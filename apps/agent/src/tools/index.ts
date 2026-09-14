import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Clinical trial search tool. Ported from the legacy ChatKit tool handler
 * (apps/web/app/api/tools/route.ts::handleGetTrials) — calls the same
 * external clinical-trials-matching API directly from the agent process.
 *
 * Requires CLINICAL_TRIALS_API_KEY in apps/agent's environment.
 */
const TRIALS_API_URL =
  "https://ltqkud1tu1.execute-api.us-west-2.amazonaws.com/Prod/get_trials";

const getTrialsSchema = z.object({
  age: z.number().int().min(0).max(200).optional(),
  min_age: z.number().int().min(0).max(200).optional(),
  max_age: z.number().int().min(0).max(200).optional(),
  sex: z.enum(["male", "female", "all"]).optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipcode: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  conditions: z
    .array(z.string())
    .optional()
    .describe("Medical conditions the patient has, e.g. ['Alzheimer Disease']"),
  pref_distance: z
    .number()
    .optional()
    .describe("Preferred maximum distance (miles) for clinical trials."),
  drive_duration: z.number().optional(),
  top_n: z
    .number()
    .int()
    .optional()
    .describe("Number of top clinical trials to return, recommended 5-10."),
  intervention_types: z.array(z.string()).optional(),
  phases: z.array(z.string()).optional(),
});

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

type RawMatchedTrial = {
  clinical_trial?: {
    id?: string;
    title?: string;
    recruitment_status?: string;
    conditions?: string[];
    phases?: string[];
    intervention_types?: string[];
  };
  matched_locations?: RawMatchedLocation[];
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
    locations,
    rank: raw.rank,
  };
}

export const getTrials = tool(
  async (input) => {
    const apiKey = process.env.CLINICAL_TRIALS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "Clinical trials API key not configured on the agent.",
      };
    }

    const requestBody: Record<string, unknown> = { ...input, page: 1 };

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

      return {
        success: true,
        count: matchedTrials.length,
        trials: matchedTrials,
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
  },
  {
    name: "get_trials",
    description:
      "Search for clinical trials matching patient criteria including age, sex, location, medical conditions, and preferences. Returns a list of matching trials with detailed information and match reports.",
    schema: getTrialsSchema,
  },
);

export const tools = [getTrials];
