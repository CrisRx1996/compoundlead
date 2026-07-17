"use client";

import { useEffect, useMemo, useState } from "react";
import { STATES, stateByAbbr } from "@/lib/territory";
import { KEYWORD_GROUPS } from "@/lib/keywords";
import type { Lead, SearchResponse } from "@/lib/types";
import ResultsTable from "@/components/ResultsTable";

type Status = "idle" | "searching" | "enriching" | "done";
type Tab = "find" | "saved" | "exports" | "how";

const BANDS = ["HOT", "QUALIFIED", "REVIEW", "LOW"] as const;
const BAND_META: Record<(typeof BANDS)[number], { color: string; tint: string }> = {
  HOT: { color: "var(--hot)", tint: "var(--hot-tint)" },
  QUALIFIED: { color: "var(--qual)", tint: "var(--qual-tint)" },
  REVIEW: { color: "var(--review)", tint: "var(--review-tint)" },
  LOW: { color: "var(--low)", tint: "var(--low-tint)" },
};

const shortLabel = (label: string) => label.split(" / ")[0];

type SavedSearch = {
  id: string;
  name: string;
  state: string;
  city: string;
  keywords: string[];
  freeform: string;
  savedAt: number;
};

type ExportEntry = {
  id: string;
  filename: string;
  format: "csv" | "xlsx";
  state: string;
  city: string;
  count: number;
  timestamp: number;
};

const LS_SAVED = "compoundlead_saved_searches_v1";
const LS_EXPORTS = "compoundlead_export_history_v1";

function loadLS<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
function saveLS<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function relativeTime(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("find");

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

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportEntry[]>([]);

  useEffect(() => {
    setSavedSearches(loadLS<SavedSearch>(LS_SAVED));
    setExportHistory(loadLS<ExportEntry>(LS_EXPORTS));
  }, []);

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
    const filename = `${city.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}-leads`;
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: shown, format, filename }),
    });
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.${format}`;
    a.click();
    URL.revokeObjectURL(url);

    const entry: ExportEntry = {
      id: newId(),
      filename: `${filename}.${format}`,
      format,
      state,
      city,
      count: shown.length,
      timestamp: Date.now(),
    };
    const next = [entry, ...exportHistory].slice(0, 50);
    setExportHistory(next);
    saveLS(LS_EXPORTS, next);
  }

  function saveCurrentSearch() {
    if (!hasSelection) return;
    const defaultName = `${city}, ${state}`;
    const name = window.prompt("Name this saved search:", defaultName);
    if (!name) return;
    const entry: SavedSearch = {
      id: newId(),
      name: name.trim() || defaultName,
      state,
      city,
      keywords: [...selected],
      freeform,
      savedAt: Date.now(),
    };
    const next = [entry, ...savedSearches];
    setSavedSearches(next);
    saveLS(LS_SAVED, next);
  }

  function loadSavedSearch(s: SavedSearch) {
    setState(s.state);
    setCity(s.city);
    setSelected(s.keywords);
    setFreeform(s.freeform);
    setTab("find");
  }

  function deleteSavedSearch(id: string) {
    const next = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(next);
    saveLS(LS_SAVED, next);
  }

  function clearExportHistory() {
    if (!window.confirm("Clear all export history? This can't be undone.")) return;
    setExportHistory([]);
    saveLS(LS_EXPORTS, []);
  }

  const busy = status === "searching";
  const isLive = meta?.live ?? false;
  const hasSelection = selected.length > 0 || freeform.trim().length > 0;

  const TABS: { id: Tab; label: string }[] = [
    { id: "find", label: "Find Prescribers" },
    { id: "saved", label: "Saved Searches" },
    { id: "exports", label: "Exports" },
    { id: "how", label: "How It Works" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top nav */}
      <nav className="nav-container">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
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
              className="brand-subtitle-mobile-hide"
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

        <div className="nav-tabs">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  background: active ? "var(--accent-tint)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-dim)",
                  border: "none",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="nav-mobile-select">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
            aria-label="Navigate sections"
          >
            {TABS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="nav-spacer" />

        <div
          className="nav-pill"
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
      <div className="page-container">
        {tab === "find" && (
          <>
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
              <div style={sectionLabel}>
                <span>🔭</span> Filters
              </div>

              <div className="filters-grid">
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
              <div style={{ ...sectionLabel, marginBottom: 10 }}>Categories</div>
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
                        fontFamily: "inherit",
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
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={search}
                  disabled={busy || !hasSelection}
                  style={{
                    padding: "10px 20px",
                    background: busy || !hasSelection ? "var(--bg-input)" : "var(--accent)",
                    color: busy || !hasSelection ? "var(--text-mute)" : "#0A0F1E",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: busy || !hasSelection ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "inherit",
                  }}
                >
                  <span>🔍</span>
                  {busy ? "Searching…" : "Search practices"}
                </button>
                <button
                  onClick={saveCurrentSearch}
                  disabled={!hasSelection}
                  style={{
                    padding: "10px 16px",
                    background: "transparent",
                    color: hasSelection ? "var(--accent)" : "var(--text-mute)",
                    border: `1px solid ${hasSelection ? "var(--accent)" : "var(--border-strong)"}`,
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: hasSelection ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  ⭐ Save search
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
                    fontFamily: "inherit",
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
                  <span style={{ fontSize: 12, color: "var(--hot)", marginLeft: 8 }}>
                    {error}
                  </span>
                )}
              </div>
            </section>

            {/* Results section */}
            {leads.length > 0 && (
              <section>
                <div className="results-header">
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

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

                  <div style={{ flex: 1, minWidth: 0 }} />

                  <button onClick={() => download("csv")} style={exportBtn}>
                    ⬇ CSV
                  </button>
                  <button onClick={() => download("xlsx")} style={exportBtn}>
                    ⬇ Excel
                  </button>
                </div>

                <div className="results-table-wrap">
                  <ResultsTable leads={shown} />
                </div>
              </section>
            )}

            {leads.length === 0 && !busy && !error && (
              <div style={emptyPanel}>
                <div style={{ fontSize: 15, color: "var(--text)", marginBottom: 4, fontWeight: 500 }}>
                  Pick a city and hit search
                </div>
                <div style={{ fontSize: 13 }}>
                  Categories above drive the search. Weights (w20, w28, etc.) tell you how strongly each category predicts a
                  compounding buyer.
                </div>
              </div>
            )}
          </>
        )}

        {tab === "saved" && (
          <SavedSearchesTab
            entries={savedSearches}
            onLoad={loadSavedSearch}
            onDelete={deleteSavedSearch}
            onGoFind={() => setTab("find")}
          />
        )}

        {tab === "exports" && (
          <ExportsTab entries={exportHistory} onClear={clearExportHistory} onGoFind={() => setTab("find")} />
        )}

        {tab === "how" && <HowItWorksTab />}
      </div>
    </div>
  );
}

/* ---------- Saved Searches tab ---------- */

function SavedSearchesTab({
  entries,
  onLoad,
  onDelete,
  onGoFind,
}: {
  entries: SavedSearch[];
  onLoad: (s: SavedSearch) => void;
  onDelete: (id: string) => void;
  onGoFind: () => void;
}) {
  if (entries.length === 0) {
    return (
      <div style={emptyPanel}>
        <div style={{ fontSize: 15, color: "var(--text)", marginBottom: 8, fontWeight: 500 }}>
          No saved searches yet
        </div>
        <div style={{ fontSize: 13, marginBottom: 16 }}>
          Save the state, city, and categories you use most so you can rerun them with one click.
        </div>
        <button
          onClick={onGoFind}
          style={{
            padding: "9px 18px",
            background: "var(--accent)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Go to Find Prescribers
        </button>
      </div>
    );
  }

  return (
    <section
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 20,
      }}
    >
      <div style={{ ...sectionLabel, marginBottom: 14 }}>
        <span>⭐</span> Saved Searches · {entries.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.name}</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-mute)",
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                {s.city}, {s.state} · {s.keywords.length} categor{s.keywords.length === 1 ? "y" : "ies"}
                {s.freeform ? ` · +"${s.freeform}"` : ""} · saved {relativeTime(s.savedAt)}
              </div>
            </div>
            <button
              onClick={() => onLoad(s)}
              style={{
                padding: "7px 14px",
                background: "var(--accent)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Load
            </button>
            <button
              onClick={() => onDelete(s.id)}
              style={{
                padding: "7px 12px",
                background: "transparent",
                color: "var(--text-mute)",
                border: "1px solid var(--border-strong)",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Exports tab ---------- */

function ExportsTab({
  entries,
  onClear,
  onGoFind,
}: {
  entries: ExportEntry[];
  onClear: () => void;
  onGoFind: () => void;
}) {
  if (entries.length === 0) {
    return (
      <div style={emptyPanel}>
        <div style={{ fontSize: 15, color: "var(--text)", marginBottom: 8, fontWeight: 500 }}>
          No exports yet
        </div>
        <div style={{ fontSize: 13, marginBottom: 16 }}>
          Every CSV or Excel you download from a search will be logged here so you can keep track of what you sent where.
        </div>
        <button
          onClick={onGoFind}
          style={{
            padding: "9px 18px",
            background: "var(--accent)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Go to Find Prescribers
        </button>
      </div>
    );
  }

  return (
    <section
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={sectionLabel}>
          <span>📦</span> Export History · {entries.length}
        </div>
        <button
          onClick={onClear}
          style={{
            padding: "6px 12px",
            background: "transparent",
            color: "var(--text-mute)",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Clear all
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map((e) => (
          <div
            key={e.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                background: e.format === "csv" ? "var(--qual-tint)" : "var(--accent-tint)",
                color: e.format === "csv" ? "var(--qual)" : "var(--accent)",
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
              }}
            >
              {e.format.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div
                style={{
                  fontWeight: 500,
                  fontSize: 13,
                  marginBottom: 3,
                  fontFamily: '"IBM Plex Mono", monospace',
                  wordBreak: "break-all",
                }}
              >
                {e.filename}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-mute)" }}>
                {e.count} lead{e.count === 1 ? "" : "s"} · {e.city}, {e.state} · {relativeTime(e.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- How It Works tab ---------- */

function HowItWorksTab() {
  return (
    <section
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 24,
        lineHeight: 1.65,
        fontSize: 14,
        color: "var(--text-dim)",
      }}
    >
      <div style={{ ...sectionLabel, marginBottom: 16 }}>
        <span>💡</span> How It Works
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 22 }}>
        <div>
          <div style={howTitle}>What this tool does</div>
          <p style={howBody}>
            CompoundLead surfaces prescribers, clinics, and practices in your licensed states that are likely to write
            compounding scripts. Pick a state and city, choose which categories to search (hormone optimization, weight
            loss, peptides, etc.), and get back a ranked list you can call, email, or export.
          </p>
        </div>

        <div>
          <div style={howTitle}>How the score works</div>
          <p style={howBody}>
            Every practice is scored 0–100 based on a weighted match of its business name, categories, and (when available)
            what its website says. High-value indicators like hormone optimization or medical weight loss carry more weight
            (w28, w30) than general wellness (w12). Practices that look veterinary, chain-owned, or hospital-affiliated get
            deducted. Click any row to expand a &ldquo;why this score&rdquo; panel showing every +/- reason.
          </p>
          <p style={howBody}>
            The four bands are: <strong style={{ color: "var(--hot)" }}>HOT</strong> (75+, call first),{" "}
            <strong style={{ color: "var(--qual)" }}>QUALIFIED</strong> (55–74, solid leads),{" "}
            <strong style={{ color: "var(--review)" }}>REVIEW</strong> (35–54, worth a look), and{" "}
            <strong style={{ color: "var(--low)" }}>LOW</strong> (below 35, unlikely fit).
          </p>
        </div>

        <div>
          <div style={howTitle}>Where the data comes from</div>
          <p style={howBody}>
            Business listings come from Google Places (New) Text Search — the same directory that powers Google Maps. That
            gives us the practice name, address, phone, website, rating, and business status. Emails, when we find them,
            come from scraping the clinic&rsquo;s own contact/about page directly. About 30–40% of practices publish an
            email; the rest you&rsquo;ll need to phone or use the contact form linked in the row.
          </p>
        </div>

        <div>
          <div style={howTitle}>Demo mode vs. Live mode</div>
          <p style={howBody}>
            The pill in the top-right shows the current mode. In <strong style={{ color: "var(--review)" }}>DEMO</strong>{" "}
            mode the app returns a realistic hand-crafted dataset for a few cities so you can try the workflow at zero
            cost. Adding a Google Places API key to Netlify environment variables flips it to{" "}
            <strong style={{ color: "var(--qual)" }}>LIVE</strong> mode with real, current listings for any of the 18
            licensed states.
          </p>
        </div>

        <div>
          <div style={howTitle}>Tips for the best results</div>
          <ul style={{ ...howBody, paddingLeft: 20, marginTop: 4 }}>
            <li>Start narrow: one city, 3–5 categories. Broaden if the list feels thin.</li>
            <li>Use the extra-keywords field for niches Google matches by exact phrase (e.g. &ldquo;thyroid&rdquo;).</li>
            <li>Move the min-score slider to 55+ to hide everything below the QUALIFIED band.</li>
            <li>Toggle HAS PHONE and HAS WEBSITE if you only want practices you can immediately contact.</li>
            <li>Save recurring searches so you can rerun them next month with one click.</li>
          </ul>
        </div>
      </div>
    </section>
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

const sectionLabel: React.CSSProperties = {
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
};

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

const emptyPanel: React.CSSProperties = {
  padding: "60px 24px",
  textAlign: "center",
  color: "var(--text-mute)",
  background: "var(--bg-panel)",
  border: "1px solid var(--border)",
  borderRadius: 8,
};

const howTitle: React.CSSProperties = {
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--accent)",
  marginBottom: 6,
};

const howBody: React.CSSProperties = {
  color: "var(--text-dim)",
  marginTop: 0,
  marginBottom: 8,
};
