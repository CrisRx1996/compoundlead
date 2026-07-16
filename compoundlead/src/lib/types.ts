export type ScoreBand = "HOT" | "QUALIFIED" | "REVIEW" | "LOW";

export type EmailStatus = "PUBLIC" | "NONE" | "NOT_CHECKED";

export interface ScoreReason {
  label: string;
  points: number;
}

export interface ScoreResult {
  total: number;
  band: ScoreBand;
  reasons: ScoreReason[];
}

/** A clinic, as returned to the browser. */
export interface Lead {
  id: string; // Google place_id — stable, and our dedupe key
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  website: string | null;
  domain: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  matchedKeywords: string[];
  types: string[];

  // Filled in by the enrich step, not the search step.
  email: string | null;
  emailStatus: EmailStatus;
  contactUrl: string | null;

  score: number;
  band: ScoreBand;
  reasons: ScoreReason[];

  foundVia: string[]; // which keyword searches surfaced this clinic
  source: "google_places" | "mock";
  discoveredAt: string;
}

export interface SearchRequest {
  state: string;
  city: string;
  keywords: string[];
}

export interface SearchResponse {
  leads: Lead[];
  meta: {
    live: boolean;
    queriesRun: number;
    rawResults: number;
    afterDedupe: number;
    warnings: string[];
  };
}
