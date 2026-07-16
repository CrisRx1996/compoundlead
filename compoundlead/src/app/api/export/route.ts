import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { Lead } from "@/lib/types";
import { groupById } from "@/lib/keywords";

/** Columns a rep actually works from, in the order they'd read them. */
function toRow(l: Lead) {
  return {
    "Practice": l.name,
    "Score": l.score,
    "Band": l.band,
    "Phone": l.phone ?? "",
    "Email": l.email ?? "",
    "Website": l.website ?? "",
    "Address": l.address,
    "City": l.city,
    "State": l.state,
    "ZIP": l.zip,
    "Rating": l.rating ?? "",
    "Reviews": l.reviewCount ?? "",
    "Services matched": l.matchedKeywords.map((k) => groupById(k)?.label ?? k).join("; "),
    "Why this score": l.reasons.map((r) => `${r.label} (${r.points > 0 ? "+" : ""}${r.points})`).join(" | "),
    "Found": new Date(l.discoveredAt).toLocaleDateString("en-US"),
  };
}

export async function POST(req: Request) {
  let leads: Lead[];
  let format: string;
  let filename: string;

  try {
    const body = await req.json();
    leads = body.leads;
    format = body.format ?? "csv";
    filename = body.filename ?? "compoundlead";
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  if (!Array.isArray(leads) || !leads.length) {
    return NextResponse.json({ error: "There's nothing to export." }, { status: 400 });
  }

  const rows = leads.map(toRow);
  const sheet = XLSX.utils.json_to_sheet(rows);

  if (format === "xlsx") {
    sheet["!cols"] = [
      { wch: 38 }, { wch: 6 }, { wch: 10 }, { wch: 16 }, { wch: 30 }, { wch: 34 },
      { wch: 42 }, { wch: 16 }, { wch: 6 }, { wch: 8 }, { wch: 7 }, { wch: 8 },
      { wch: 36 }, { wch: 60 }, { wch: 11 },
    ];
    sheet["!autofilter"] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(sheet["!ref"]!)) };

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Leads");
    const buf = XLSX.write(book, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  const csv = XLSX.utils.sheet_to_csv(sheet);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
