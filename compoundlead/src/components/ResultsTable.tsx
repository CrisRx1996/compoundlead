"use client";

import { Fragment, useState } from "react";
import type { Lead } from "@/lib/types";
import { KEYWORD_GROUPS } from "@/lib/keywords";
import ScoreChip from "./ScoreChip";

const em = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? (
    <span style={{ color: "var(--text-mute)", fontFamily: '"IBM Plex Mono", monospace' }}>—</span>
  ) : (
    <>{v}</>
  );

const groupName = (id: string) => {
  const g = KEYWORD_GROUPS.find((k) => k.id === id);
  return g ? g.label.split(" / ")[0] : id;
};

export default function ResultsTable({ leads }: { leads: Lead[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!leads.length) {
    return (
      <div
        style={{
          padding: "60px 40px",
          textAlign: "center",
          color: "var(--text-mute)",
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        <h3 style={{ color: "var(--text)", fontSize: 15, margin: "0 0 6px", fontWeight: 600 }}>
          No leads match your filters
        </h3>
        <p style={{ margin: 0, fontSize: 13 }}>
          Try lowering the minimum score or turning off contact filters.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "0 0 8px 8px",
        overflowX: "auto",
      }}
    >
      <table style={{ width: "100%", minWidth: 1080, borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {["Score", "Practice", "Phone", "Website", "Address", "City", "State", "ZIP", "Matched", ""].map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: "left",
                  padding: "12px 16px",
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-mute)",
                  background: "var(--bg-panel)",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const isOpen = open.has(l.id);
            const kwNames = l.matchedKeywords.map(groupName);
            return (
              <Fragment key={l.id}>
                <tr
                  onClick={() => toggle(l.id)}
                  style={{
                    cursor: "pointer",
                    background: isOpen ? "var(--bg-hover)" : "transparent",
                  }}
                >
                  <td style={cellStyle}>
                    <ScoreChip score={l.score} band={l.band} />
                  </td>
                  <td style={{ ...cellStyle, fontWeight: 500 }}>{l.name}</td>
                  <td style={{ ...cellStyle, ...monoCell, whiteSpace: "nowrap" }}>{em(l.phone)}</td>
                  <td style={cellStyle}>
                    {l.website ? (
                      <a
                        href={`https://${l.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "var(--accent)" }}
                      >
                        {l.website}
                      </a>
                    ) : (
                      em(null)
                    )}
                  </td>
                  <td style={{ ...cellStyle, ...monoCell }}>{em(l.address)}</td>
                  <td style={cellStyle}>{em(l.city)}</td>
                  <td style={{ ...cellStyle, ...monoCell }}>{em(l.state)}</td>
                  <td style={{ ...cellStyle, ...monoCell }}>{em(l.zip)}</td>
                  <td style={cellStyle}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {kwNames.map((n, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "2px 8px",
                            background: "var(--accent-tint)",
                            color: "var(--accent)",
                            borderRadius: 4,
                            fontFamily: '"IBM Plex Mono", monospace',
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right", color: "var(--text-mute)", width: 32 }}>
                    <span
                      style={{
                        display: "inline-block",
                        transition: "transform 0.15s",
                        transform: isOpen ? "rotate(90deg)" : "none",
                      }}
                    >
                      ›
                    </span>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td
                      colSpan={10}
                      style={{
                        padding: "0 16px 20px 16px",
                        background: "var(--bg-hover)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          background: "var(--bg)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: 8,
                          padding: "18px 20px",
                          maxWidth: 780,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            fontFamily: '"IBM Plex Mono", monospace',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "var(--text-mute)",
                            marginBottom: 14,
                            paddingBottom: 10,
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <span>Why this score</span>
                          <span style={{ color: "var(--text)" }}>
                            Total: {l.score} / 100 · Band: {l.band}
                          </span>
                        </div>
                        <ul
                          style={{
                            margin: 0,
                            padding: 0,
                            listStyle: "none",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "4px 24px",
                          }}
                        >
                          {l.reasons.map((r, i) => (
                            <li
                              key={i}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "44px 1fr",
                                gap: 12,
                                fontFamily: '"IBM Plex Mono", monospace',
                                fontSize: 13,
                                padding: "4px 0",
                                alignItems: "baseline",
                              }}
                            >
                              <span
                                style={{
                                  textAlign: "right",
                                  fontWeight: 600,
                                  color: r.points >= 0 ? "var(--qual)" : "var(--hot)",
                                }}
                              >
                                {r.points >= 0 ? "+" : ""}
                                {r.points}
                              </span>
                              <span style={{ color: "var(--text-dim)" }}>{r.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "14px 16px",
  verticalAlign: "middle",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
};

const monoCell: React.CSSProperties = {
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: 13,
  color: "var(--text-dim)",
};
