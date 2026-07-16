import { NextResponse } from "next/server";
import { findEmail } from "@/lib/email";
import { scoreLead } from "@/lib/score";
import type { Lead } from "@/lib/types";

export const maxDuration = 26;

/**
 * Email lookup runs separately from search, in small batches. Two reasons: the
 * search stays fast, and each request stays well inside the serverless time
 * limit no matter how many results came back.
 */
export async function POST(req: Request) {
  if (process.env.ENABLE_EMAIL_LOOKUP === "false") {
    return NextResponse.json({ error: "Email lookup is switched off." }, { status: 400 });
  }

  let leads: Lead[];
  try {
    ({ leads } = await req.json());
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  if (!Array.isArray(leads) || !leads.length) {
    return NextResponse.json({ error: "Send an array of leads." }, { status: 400 });
  }
  if (leads.length > 8) {
    return NextResponse.json({ error: "Send 8 leads at a time or fewer." }, { status: 400 });
  }

  const updated = await Promise.all(
    leads.map(async (lead) => {
      if (!lead.website || !lead.domain) {
        return { ...lead, emailStatus: "NONE" as const };
      }

      // Demo data has no real sites to read; don't pretend otherwise.
      if (lead.source === "mock") {
        const pretend = lead.domain.includes("example.com") && (lead.reviewCount ?? 0) > 50;
        const email = pretend ? `info@${lead.domain}` : null;
        const next: Lead = {
          ...lead,
          email,
          emailStatus: email ? "PUBLIC" : "NONE",
          contactUrl: email ? lead.website : null,
        };
        const s = scoreLead(next);
        return { ...next, score: s.total, band: s.band, reasons: s.reasons };
      }

      const { email, contactUrl, status } = await findEmail(lead.website, lead.domain);
      const next = { ...lead, email, contactUrl, emailStatus: status };
      const s = scoreLead(next);
      return { ...next, score: s.total, band: s.band, reasons: s.reasons };
    }),
  );

  return NextResponse.json({ leads: updated });
}
