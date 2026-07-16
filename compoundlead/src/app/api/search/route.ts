import { NextResponse } from "next/server";
import { searchCity, isLive } from "@/lib/places";
import { dedupe } from "@/lib/dedupe";
import { scoreLead } from "@/lib/score";
import { groupById } from "@/lib/keywords";
import { stateByAbbr } from "@/lib/territory";
import type { SearchRequest, SearchResponse } from "@/lib/types";

export const maxDuration = 26;

export async function POST(req: Request) {
  let body: SearchRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const { state, city, keywords } = body;

  if (!state || !city) {
    return NextResponse.json({ error: "Pick a state and a city." }, { status: 400 });
  }
  if (!stateByAbbr(state)) {
    return NextResponse.json({ error: `${state} isn't a licensed state.` }, { status: 400 });
  }
  if (!keywords?.length) {
    return NextResponse.json({ error: "Pick at least one service to search for." }, { status: 400 });
  }

  // Expand each selected group into its query phrases.
  const queries = keywords.flatMap((id) => {
    const g = groupById(id);
    if (!g) return [];
    return g.queries.map((query) => ({ keywordId: id, query }));
  });

  if (!queries.length) {
    return NextResponse.json({ error: "None of those services are recognised." }, { status: 400 });
  }

  const { leads, queriesRun, warnings } = await searchCity(city, state, queries);
  const merged = dedupe(leads);

  const scored = merged
    .map((lead) => {
      const { total, band, reasons } = scoreLead(lead);
      return { ...lead, score: total, band, reasons };
    })
    .sort((a, b) => b.score - a.score);

  const payload: SearchResponse = {
    leads: scored,
    meta: {
      live: isLive(),
      queriesRun,
      rawResults: leads.length,
      afterDedupe: scored.length,
      warnings,
    },
  };

  return NextResponse.json(payload);
}
