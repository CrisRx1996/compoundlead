import type { Lead } from "./types";

const digits = (s: string | null) => (s ? s.replace(/\D/g, "") : "");

/**
 * The same clinic shows up under several keywords — that's the point, it means
 * they do several of the things we sell. Merge those hits rather than dropping
 * them, so `matchedKeywords` reflects everything the practice does.
 *
 * Keys, in order of trust:
 *   1. place_id  — Google's own identity, exact
 *   2. phone     — catches duplicate listings for one practice
 *   3. domain + street number — catches the rest
 */
export function dedupe(leads: Lead[]): Lead[] {
  const byKey = new Map<string, Lead>();
  const keyIndex = new Map<string, string>(); // alias -> canonical key

  for (const lead of leads) {
    const aliases = [`id:${lead.id}`];
    const ph = digits(lead.phone);
    if (ph.length >= 10) aliases.push(`ph:${ph.slice(-10)}`);
    if (lead.domain) {
      const streetNum = lead.address.match(/^\d+/)?.[0] ?? "";
      aliases.push(`dm:${lead.domain}|${streetNum}`);
    }

    const existingKey = aliases.map((a) => keyIndex.get(a)).find(Boolean);

    if (existingKey) {
      const prev = byKey.get(existingKey)!;
      prev.matchedKeywords = Array.from(new Set([...prev.matchedKeywords, ...lead.matchedKeywords]));
      prev.foundVia = Array.from(new Set([...prev.foundVia, ...lead.foundVia]));
      // Prefer the record that carries more contact detail.
      prev.phone ??= lead.phone;
      prev.website ??= lead.website;
      prev.domain ??= lead.domain;
      prev.rating ??= lead.rating;
      prev.reviewCount ??= lead.reviewCount;
      for (const a of aliases) keyIndex.set(a, existingKey);
    } else {
      const key = `id:${lead.id}`;
      byKey.set(key, { ...lead });
      for (const a of aliases) keyIndex.set(a, key);
    }
  }

  return Array.from(byKey.values());
}
