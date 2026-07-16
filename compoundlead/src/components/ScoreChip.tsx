import type { ScoreBand } from "@/lib/types";

const BAND_LABEL: Record<ScoreBand, string> = {
  HOT: "HOT",
  QUALIFIED: "QUALIFIED",
  REVIEW: "REVIEW",
  LOW: "LOW",
};

export default function ScoreChip({ score, band }: { score: number; band: ScoreBand }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: 4,
        background: "var(--bg-input)",
        border: "1px solid var(--border-strong)",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          width: 36,
          height: 32,
          display: "grid",
          placeItems: "center",
          borderRadius: 4,
          fontFamily: '"IBM Plex Mono", monospace',
          fontWeight: 600,
          fontSize: 15,
          color: band === "LOW" ? "var(--text)" : "#0A0F1E",
          background:
            band === "HOT" ? "var(--hot)" :
            band === "QUALIFIED" ? "var(--qual)" :
            band === "REVIEW" ? "var(--review)" :
            "var(--low)",
        }}
      >
        {score}
      </div>
      <div
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          paddingRight: 8,
          color:
            band === "HOT" ? "var(--hot)" :
            band === "QUALIFIED" ? "var(--qual)" :
            band === "REVIEW" ? "var(--review)" :
            "var(--low)",
        }}
      >
        {BAND_LABEL[band]}
      </div>
    </div>
  );
}
