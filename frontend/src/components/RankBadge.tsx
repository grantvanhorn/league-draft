import { tierColor } from "../lib/ddragon";
import { RankedEntry } from "../types";

interface Props {
  entry: RankedEntry | null;
  showLP?: boolean;
  showRecord?: boolean;
  size?: "sm" | "md";
}

export default function RankBadge({ entry, showLP = false, showRecord = false, size = "md" }: Props) {
  if (!entry) {
    return <span style={{ color: "#8899aa", fontSize: size === "sm" ? 11 : 13 }}>Unranked</span>;
  }

  const color = tierColor(entry.tier);
  const fontSize = size === "sm" ? 11 : 13;
  const dotSize = size === "sm" ? 8 : 10;
  const total = entry.wins + entry.losses;
  const wr = total > 0 ? Math.round((entry.wins / total) * 100) : 0;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: dotSize, height: dotSize, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
      <span style={{ color, fontWeight: 600, fontSize }}>
        {entry.tier} {entry.rank}
      </span>
      {showLP && (
        <span style={{ color: "#cbd5e1", fontSize: fontSize - 1 }}>{entry.leaguePoints} LP</span>
      )}
      {showRecord && total > 0 && (
        <span style={{ color: wr >= 50 ? "#4ade80" : "#f87171", fontSize: fontSize - 1 }}>
          {wr}% ({entry.wins}W {entry.losses}L)
        </span>
      )}
    </span>
  );
}
