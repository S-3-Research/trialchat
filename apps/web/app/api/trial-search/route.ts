import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Stateless trial-search endpoint used by the shared Search Controller
 * (see contexts/TrialSearchContext.tsx). Both the Trial Panel's direct
 * structured filters and (indirectly, via the agent's own copy of this
 * same external call — see apps/agent/src/tools/trial-search.tool.ts)
 * Chat converge on the same external clinical-trials-matching API here.
 *
 * The backend does not know or care whether a request is a refine, a new
 * search, a panel filter change, or pagination — that's an
 * application-level distinction the Search Controller owns.
 */
const TRIALS_API_URL =
  "https://ltqkud1tu1.execute-api.us-west-2.amazonaws.com/Prod/get_trials";

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
 * The external API doesn't return a structured `total`/`total_pages` field
 * — it embeds them in `summary_report`'s free text, e.g. "We found total 27
 * matched trial in our database, total 6 pages." Parse them out here so
 * the panel can show an accurate count instead of just "N loaded so far".
 * Falls back to page-size-based estimation if the text ever changes shape.
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

type TrialSearchRequestBody = {
  criteria?: Record<string, unknown>;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.CLINICAL_TRIALS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Clinical trials API key not configured" },
      { status: 500 }
    );
  }

  let body: TrialSearchRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const criteria = body.criteria ?? {};
  const page = Math.max(1, Number(body.page ?? 1));
  const pageSize = Number(body.pageSize ?? 10);

  // Map our criteria shape -> external API shape.
  const requestBody: Record<string, unknown> = { ...criteria, page };
  if (
    "recruitingStatus" in criteria &&
    criteria.recruitingStatus === "recruiting"
  ) {
    // The external API doesn't have a dedicated recruiting-only flag in
    // this legacy integration; leave as an app-level filter applied below
    // once results come back, but still forward it in case the backend
    // adds support later.
  }
  requestBody.top_n = criteria.top_n ?? pageSize;
  delete requestBody.recruitingStatus;

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
      return NextResponse.json(
        {
          success: false,
          error: `Clinical trials API error: ${response.status}`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      matched_trial?: RawMatchedTrial[];
      summary_report?: string;
      total?: number;
    };

    let trials = (data.matched_trial ?? []).map(flattenTrial);

    if (criteria.recruitingStatus === "recruiting") {
      trials = trials.filter((t) =>
        (t.recruitment_status ?? "").toLowerCase().includes("recruiting")
      );
    }

    const { total: parsedTotal, totalPages } = parseTotalsFromSummary(
      data.summary_report
    );
    const total = data.total ?? parsedTotal ?? trials.length;
    const hasNextPage =
      typeof totalPages === "number"
        ? page < totalPages
        : trials.length >= pageSize;

    return NextResponse.json({
      success: true,
      trials,
      summary: data.summary_report ?? `Found ${trials.length} matching trials`,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch clinical trials",
      },
      { status: 500 }
    );
  }
}
