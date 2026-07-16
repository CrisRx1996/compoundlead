"use client";

import { useMemo, useState } from "react";
import { STATES, stateByAbbr } from "@/lib/territory";
import { KEYWORD_GROUPS } from "@/lib/keywords";
import type { Lead, SearchResponse } from "@/lib/types";
import ResultsTable from "@/components/ResultsTable";

type Status = "idle" | "searching" | "enriching" | "done";

const BANDS = ["HOT", "QUALIFIED", "REVIEW", "LOW"] as const;
const BAND_META: Record<(typeof BANDS)[number], { color: string; tint: string }> = {
  HOT: { color: "var(--hot)", tint: "var(--hot-tint)" },
  QUALIFIED: { color: "var(--qual)", tint: "var(--qual-tint)" },
  REVIEW: { color: "var(--review)", tint: "var(--review-tint)" },
  LOW: { color: "var(--low)", tint: "var(--low-tint)" },
};

const shortLabel = (label: string) => label.split(" / ")[0];

export default function Page() {
  const [state, setState] = useState("NV");
  const [city, setCity] = useState("Las Vegas");
  const [freeform, setFreeform] = useState("");
  const [selected, setSelected] = useState<string[]>(
    KEYWORD_GROUPS.filter((g) => g.defaultOn).map((g) => g.id),
  );

  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<SearchResponse["meta"] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const [minScore, setMinScore] = useState(0);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [needsWebsite, setNeedsWebsite] = useState(false);

  const cities = stateByAbbr(state)?.cities ?? [];

  const shown = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.score >= minScore &&
          (!needsPhone || l.phone) &&
          (!needsWebsite || l.website),
      ),
    [leads, minScore, needsPhone, needsWebsite],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { HOT: 0, QUALIFIED: 0, REVIEW: 0, LOW: 0 };
    for (const l of leads) c[l.band]++;
    return c;
  }, [leads]);

  function toggleGroup(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function clearAll() {
    setSelected([]);
    setFreeform("");
  }

  async function search() {
    if (!state || !city || (selected.length === 0 && !freeform.trim())) return;
    setStatus("searching");
    setError(null);
    setLeads([]);
    setMeta(null);

    const keywords = [...selected];
    // Freeform: pass extra terms through the standard keywords array
    if (freeform.trim()) keywords.push(`__custom:${freeform.trim()}`);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, city, keywords }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed.");

      setLeads(data.leads);
      setMeta(data.meta);
      setStatus("done");
      void enrich(data.leads);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
      setStatus("idle");
    }
  }

  async function enrich(all: Lead[]) {
    const queue = all.filter((l) => l.website).slice(0, 40);
    if (!queue.length) return;

    setStatus("enriching");
    setProgress({ done: 0, total: queue.length });

    for (let i = 0; i < queue.length; i += 6) {
      const batch = queue.slice(i, i + 6);
      try {
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads: batch }),
        });
        if (!res.ok) continue;

        const { leads: updated } = (await res.json()) as { leads: Lead[] };
        setLeads((prev) => {
          const map = new Map(updated.map((u) => [u.id, u]));
          return prev.map((p) => map.get(p.id) ?? p).sort((a, b) => b.score - a.score);
        });
      } catch {
        // Ignore sites that don't respond
      }
      setProgress((p) => ({ ...p, done: Math.min(p.done + 6, queue.length) }));
    }

    setStatus("done");
  }

  async function download(format: "csv" | "xlsx") {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leads: shown,
        format,
        filename: `${city.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}-leads`,
      }),
    });
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${city.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}-leads.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const busy = status === "searching";
  const isLive = meta?.live ?? false;
  const hasSelection = selected.length > 0 || freeform.trim().length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top nav */}
      <nav
        style={{
          height: 56,
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-panel)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "linear-gradient(135deg, var(--accent), #6366F1)",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              color: "#0A0F1E",
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: 15,
            }}
          >
            C
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>CompoundLead</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-mute)",
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              Prescriber Prospecting · QCRx
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, marginLeft: 24 }}>
          {[
            { id: "find", label: "Find Prescribers", active: true },
            { id: "saved", label: "Saved Searches" },
            { id: "exports", label: "Exports" },
            { id: "how", label: "How It Works" },
          ].map((t) => (
            <div
              key={t.id}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: t.active ? "default" : "pointer",
                background: t.active ? "var(--accent-tint)" : "transparent",
                color: t.active ? "var(--accent)" : "var(--text-dim)",
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            padding: "5px 12px",
            borderRadius: 999,
            fontSize: 11,
            fontFamily: '"IBM Plex Mono", monospace',
            fontWeight: 600,
            letterSpacing: "0.08em",
            background: isLive ? "var(--qual-tint)" : "var(--review-tint)",
            color: isLive ? "var(--qual)" : "var(--review)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: isLive ? "var(--qual)" : "var(--review)",
            }}
          />
          {isLive ? "LIVE" : "DEMO"}
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        {/* Filters section */}
        <section
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-mute)",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>🔭</span> Filters
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.4fr 2fr",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <FieldGroup label="STATE">
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  const first = stateByAbbr(e.target.value)?.cities[0];
                  if (first) setCity(first);
                }}
                style={inputStyle}
              >
                {STATES.map((s) => (
                  <option key={s.abbr} value={s.abbr}>
                    {s.name} ({s.abbr})
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="CITY">
              <select value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle}>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="KEYWORDS (OPTIONAL — extra terms)">
              <input
                type="text"
                value={freeform}
                onChange={(e) => setFreeform(e.target.value)}
                placeholder="e.g. thyroid, functional medicine..."
                style={inputStyle}
              />
            </FieldGroup>
          </div>

          {/* Category chips */}
          <div
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-mute)",
              marginBottom: 10,
            }}
          >
            Categories
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {KEYWORD_GROUPS.map((g) => {
              const active = selected.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGroup(g.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px 8px 8px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    background: active ? "var(--accent-tint-strong)" : "var(--bg-input)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
                    color: active ? "var(--accent)" : "var(--text-dim)",
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: active ? "var(--accent)" : "transparent",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
                      display: "grid",
                      placeItems: "center",
                      color: "#0A0F1E",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {active ? "✓" : ""}
                  </span>
                  {shortLabel(g.label)}
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: 10,
                      color: active ? "var(--accent)" : "var(--text-mute)",
                      opacity: 0.7,
                    }}
                  >
                    w{g.weight}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action row */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={search}
              disabled={busy || !hasSelection}
              style={{
                padding: "10px 20px",
                background:
                  busy || !hasSelection
                    ? "var(--bg-input)"
                    : "var(--accent)",
                color: busy || !hasSelection ? "var(--text-mute)" : "#0A0F1E",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: busy || !hasSelection ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>🔍</span>
              {busy ? "Searching…" : "Search practices"}
            </button>
            <button
              onClick={clearAll}
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: "var(--text-dim)",
                border: "1px solid var(--border-strong)",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
            {status === "enriching" && (
              <span
                style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 12,
                  color: "var(--text-mute)",
                  marginLeft: 8,
                }}
              >
                Looking up emails… {progress.done}/{progress.total}
              </span>
            )}
            {error && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--hot)",
                  marginLeft: 8,
                }}
              >
                {error}
              </span>
            )}
          </div>
        </section>

        {/* Results section */}
        {leads.length > 0 && (
          <section>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--text-mute)",
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>📋</span> Results · {shown.length} shown of {leads.length}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-mute)" }}>
                  Source: Google Places ({isLive ? "Live" : "Demo"})
                  {meta && ` · ${meta.rawResults} raw · ${meta.afterDedupe} after dedupe`}
                </div>
              </div>

              {/* Band count strip */}
              <div style={{ display: "flex", gap: 6 }}>
                {BANDS.map((b) => (
                  <div
                    key={b}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: BAND_META[b].tint,
                      color: BAND_META[b].color,
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {b} <span style={{ opacity: 0.85 }}>{counts[b]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sub-filter bar */}
            <div
              style={{
                display: "flex",
                gap: 20,
                alignItems: "center",
                padding: "12px 16px",
                background: "var(--bg-panel)",
                borderRadius: "8px 8px 0 0",
                border: "1px solid var(--border)",
                borderBottom: "none",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 12,
                  color: "var(--text-dim)",
                }}
              >
                <span>MIN SCORE</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  style={{ width: 160, accentColor: "var(--accent)" }}
                />
                <span style={{ color: "var(--text)", minWidth: 24 }}>{minScore}</span>
              </label>

              <Toggle label="HAS PHONE" checked={needsPhone} onChange={setNeedsPhone} />
              <Toggle label="HAS WEBSITE" checked={needsWebsite} onChange={setNeedsWebsite} />

              <div style={{ flex: 1 }} />

              <button onClick={() => download("csv")} style={exportBtn}>
                ⬇ CSV
              </button>
              <button onClick={() => download("xlsx")} style={exportBtn}>
                ⬇ Excel
              </button>
            </div>

            <ResultsTable leads={shown} />
          </section>
        )}

        {leads.length === 0 && !busy && !error && (
          <div
            style={{
              padding: "60px 24px",
              textAlign: "center",
              color: "var(--text-mute)",
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 15, color: "var(--text)", marginBottom: 4, fontWeight: 500 }}>
              Pick a city and hit search
            </div>
            <div style={{ fontSize: 13 }}>
              Categories on the left drive the search. Weights (w20, w28, etc.) tell you how strongly each category predicts a
              compounding buyer.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Small helpers ---------- */

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.1em",
          color: "var(--text-mute)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: 12,
        color: checked ? "var(--accent)" : "var(--text-dim)",
        cursor: "pointer",
      }}
    >
      <span
        onClick={() => onChange(!checked)}
        style={{
          width: 32,
          height: 18,
          borderRadius: 999,
          background: checked ? "var(--accent)" : "var(--bg-input)",
          border: `1px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
          position: "relative",
          transition: "background 0.12s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: checked ? 15 : 1,
            width: 14,
            height: 14,
            borderRadius: 999,
            background: checked ? "#0A0F1E" : "var(--text-dim)",
            transition: "left 0.12s",
          }}
        />
      </span>
      {label}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "var(--bg-input)",
  border: "1px solid var(--border-strong)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

const exportBtn: React.CSSProperties = {
  padding: "7px 14px",
  background: "var(--bg-input)",
  color: "var(--text)",
  border: "1px solid var(--border-strong)",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: '"IBM Plex Mono", monospace',
  fontWeight: 500,
  cursor: "pointer",
};
