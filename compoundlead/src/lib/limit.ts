import { getStore } from "@netlify/blobs";

/**
 * Daily search cap.
 *
 * Counts live searches per UTC day and refuses new ones past the limit, so a
 * runaway click-fest can't burn Google Places quota (and therefore money).
 *
 * Storage is Netlify Blobs, which is provisioned automatically for this site —
 * no keys or setup required. If Blobs is unreachable for any reason we FAIL
 * OPEN (allow the search) rather than break the app for the user. The per-search
 * request ceiling in places.ts is the backstop for that case.
 *
 * To change the cap, edit DAILY_LIMIT below, commit, and let Netlify redeploy.
 */

export const DAILY_LIMIT = 25;

/** Only live searches cost money; demo mode is free and uncapped. */
const STORE_NAME = "compoundlead-usage";

function todayKey(): string {
  return `searches-${new Date().toISOString().slice(0, 10)}`;
}

export interface LimitStatus {
  allowed: boolean;
  used: number;
  limit: number;
  /** True when the counter could not be read or written. */
  degraded: boolean;
}

/**
 * Reads today's count, and increments it when the search is allowed to proceed.
 * Call this once per search request, before any Places call.
 */
export async function consumeDailySearch(): Promise<LimitStatus> {
  try {
    const store = getStore(STORE_NAME);
    const key = todayKey();

    const raw = await store.get(key);
    const used = raw ? Number.parseInt(raw, 10) || 0 : 0;

    if (used >= DAILY_LIMIT) {
      return { allowed: false, used, limit: DAILY_LIMIT, degraded: false };
    }

    await store.set(key, String(used + 1));
    return { allowed: true, used: used + 1, limit: DAILY_LIMIT, degraded: false };
  } catch {
    // Blobs unavailable — don't block the user.
    return { allowed: true, used: 0, limit: DAILY_LIMIT, degraded: true };
  }
}

/** Human-readable reset time for the error message. */
export function resetsIn(): string {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
  );
  const mins = Math.max(1, Math.round((midnight - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}
