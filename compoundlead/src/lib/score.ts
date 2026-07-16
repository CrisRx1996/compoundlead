import type { Lead, ScoreBand, ScoreResult, ScoreReason } from "./types";
import { groupById } from "./keywords";

/**
 * Scoring answers one question: how likely is this clinic to write compounded scripts?
 *
 * Every point is attributable. Nothing is a black box — the UI shows the same
 * reasons array back to the user, so a rep can argue with the number.
 */

const BANDS: [number, ScoreBand][] = [
  [80, "HOT"],
  [60, "QUALIFIED"],
  [40, "REVIEW"],
  [0, "LOW"],
];

export function bandFor(total: number): ScoreBand {
  return BANDS.find(([min]) => total >= min)![1];
}

type ScoreInput = Pick<
  Lead,
  "name" | "matchedKeywords" | "phone" | "website" | "email" | "rating" | "reviewCount" | "types" | "businessStatus"
>;

export function scoreLead(lead: ScoreInput): ScoreResult {
  const reasons: ScoreReason[] = [];
  const add = (label: string, points: number) => {
    if (points !== 0) reasons.push({ label, points });
  };

  // 1. Service match (0–45). The strongest single signal.
  //    Highest-weight matched group carries; extras add a little.
  const weights = lead.matchedKeywords
    .map((id) => groupById(id)?.weight ?? 0)
    .sort((a, b) => b - a);

  if (weights.length) {
    const primary = Math.min(weights[0], 30);
    add(`Matched ${groupById(lead.matchedKeywords[0])?.label ?? "a target service"}`, primary);

    const extras = weights.slice(1);
    if (extras.length) {
      const bonus = Math.min(extras.length * 5, 15);
      add(`Also matched ${extras.length} other target service${extras.length > 1 ? "s" : ""}`, bonus);
    }
  }

  // 2. Name signals (0–12). A clinic that says it in the name is committed to it.
  const name = lead.name.toLowerCase();
  const nameSignals = [
    ["hormone", 8],
    ["weight loss", 8],
    ["testosterone", 8],
    ["men's health", 6],
    ["mens health", 6],
    ["peptide", 8],
    ["longevity", 6],
    ["anti-aging", 6],
    ["wellness", 3],
    ["regenerative", 5],
  ] as const;
  const hit = nameSignals.filter(([term]) => name.includes(term));
  if (hit.length) {
    const pts = Math.min(hit.reduce((s, [, p]) => s + p, 0), 12);
    add(`Practice name signals "${hit[0][0]}"`, pts);
  }

  // 3. Contactability (0–25). An unreachable lead is worth nothing to a rep.
  if (lead.phone) add("Phone number available", 10);
  if (lead.website) add("Website available", 8);
  if (lead.email) add("Public email found", 7);
  if (!lead.phone && !lead.website) add("No phone or website", -10);

  // 4. Market presence (0–18). Reviews are a rough proxy for patient volume.
  const rc = lead.reviewCount ?? 0;
  if (rc >= 200) add(`${rc} reviews — high patient volume`, 12);
  else if (rc >= 50) add(`${rc} reviews — established`, 8);
  else if (rc >= 10) add(`${rc} reviews`, 4);
  else if (rc > 0) add(`Only ${rc} reviews`, 1);
  else add("No reviews", 0);

  const rating = lead.rating ?? 0;
  if (rating >= 4.5 && rc >= 10) add(`${rating.toFixed(1)}★ rating`, 6);
  else if (rating >= 4.0 && rc >= 10) add(`${rating.toFixed(1)}★ rating`, 3);
  else if (rating > 0 && rating < 3.5 && rc >= 10) add(`${rating.toFixed(1)}★ rating — below average`, -4);

  // 5. Disqualifiers.
  if (lead.businessStatus && lead.businessStatus !== "OPERATIONAL") {
    add(`Listed as ${lead.businessStatus.toLowerCase().replace(/_/g, " ")}`, -40);
  }

  const raw = reasons.reduce((s, r) => s + r.points, 0);
  const total = Math.max(0, Math.min(100, raw));

  return { total, band: bandFor(total), reasons };
}
