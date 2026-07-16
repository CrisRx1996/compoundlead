import type { Lead } from "./types";
import { EXCLUDE_TERMS } from "./keywords";
import { mockPlacesFor } from "./mock";

/**
 * Google Places API (New) — Text Search.
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Billing note: Places bills at the highest-priced field you ask for. We request
 * exactly what the table needs and nothing more. Confirm current SKU pricing in
 * the Cloud Console before promising anyone a monthly number.
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.types",
  "nextPageToken",
].join(",");

interface RawPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  types?: string[];
}

export const isLive = () => Boolean(process.env.GOOGLE_PLACES_API_KEY);

function component(p: RawPlace, type: string): string {
  return p.addressComponents?.find((c) => c.types.includes(type))?.shortText ?? "";
}

function domainOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isExcluded(name: string, types: string[] = []): boolean {
  const hay = `${name} ${types.join(" ")}`.toLowerCase();
  return EXCLUDE_TERMS.some((t) => hay.includes(t));
}

function toLead(p: RawPlace, keywordId: string, query: string, source: "google_places" | "mock"): Lead {
  return {
    id: p.id,
    name: p.displayName?.text ?? "Unknown",
    address: p.formattedAddress ?? "",
    city: component(p, "locality"),
    state: component(p, "administrative_area_level_1"),
    zip: component(p, "postal_code"),
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    domain: domainOf(p.websiteUri),
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    businessStatus: p.businessStatus ?? null,
    matchedKeywords: [keywordId],
    types: p.types ?? [],
    email: null,
    emailStatus: "NOT_CHECKED",
    contactUrl: null,
    score: 0,
    band: "LOW",
    reasons: [],
    foundVia: [query],
    source,
    discoveredAt: new Date().toISOString(),
  };
}

/**
 * One text query, paginated. Each page is a billable call, so pages is capped.
 * 1 page = 20 results. 3 pages = 60, which is plenty for a single city.
 */
async function searchOnce(
  query: string,
  keywordId: string,
  city: string,
  state: string,
  maxPages = 2,
): Promise<Lead[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;

  if (!key) {
    return mockPlacesFor(keywordId, city, state)
      .filter((p) => !isExcluded(p.displayName.text, p.types))
      .map((p) => toLead(p as RawPlace, keywordId, query, "mock"));
  }

  const out: Lead[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 20,
        ...(pageToken ? { pageToken } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Places API ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as { places?: RawPlace[]; nextPageToken?: string };
    for (const p of json.places ?? []) {
      if (isExcluded(p.displayName?.text ?? "", p.types)) continue;
      out.push(toLead(p, keywordId, query, "google_places"));
    }

    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}

/** Runs every selected keyword group against one city. */
export async function searchCity(
  city: string,
  state: string,
  keywordQueries: { keywordId: string; query: string }[],
): Promise<{ leads: Lead[]; queriesRun: number; warnings: string[] }> {
  const warnings: string[] = [];
  const leads: Lead[] = [];
  let queriesRun = 0;

  for (const { keywordId, query } of keywordQueries) {
    const full = `${query} in ${city}, ${state}`;
    try {
      const found = await searchOnce(full, keywordId, city, state, isLive() ? 2 : 1);
      leads.push(...found);
      queriesRun += 1;
    } catch (err) {
      warnings.push(`"${query}" failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return { leads, queriesRun, warnings };
}
