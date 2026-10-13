import { FiExternalLink } from "react-icons/fi";
import { TournamentRosterEntry } from "../types";

const POS_ORDER: Record<string, number> = {
  TOP: 0, JUNGLE: 1, MID: 2, BOT: 3, SUPPORT: 4, SUB: 5,
};

function buildOpggUrl(roster: TournamentRosterEntry[]): string {
  const sorted = [...roster].sort(
    (a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9)
  );
  const summoners = sorted
    .map((r) => r.riotId.replace("#", "%23"))
    .join("%2C");
  return `https://op.gg/lol/multisearch/na?summoners=${summoners}`;
}

export default function OpggMultiLink({ roster }: { roster: TournamentRosterEntry[] }) {
  if (roster.length === 0) return null;

  return (
    <a
      href={buildOpggUrl(roster)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 20,
        background: "#c8102e",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        textDecoration: "none",
        letterSpacing: 0.3,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      op.gg <FiExternalLink size={11} />
    </a>
  );
}
