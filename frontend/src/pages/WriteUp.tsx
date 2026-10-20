import { useParams } from "react-router-dom";

// ─── Shared types & helpers ───────────────────────────────────────────────────

interface ChampEntry {
  name: string;
  games: number;
  wr: number;
  kda: number;
  avgDmg: number;
  avgCs: number;
  note?: string;
}

interface PlayerEntry {
  name: string;
  role: string;
  tier: string;
  rank: string;
  lp: number;
  games: number;
  wr: number;
  kda: number;
  avgDmg: number;
  avgCs: number;
  champs: ChampEntry[];
  playstyle: string;
  threats: string[];
  weaknesses: string[];
}

const ROLE_COLOR: Record<string, string> = {
  TOP: "#f59e0b",
  JGL: "#22c55e",
  MID: "#3b82f6",
  BOT: "#a855f7",
  SUP: "#ec4899",
};

const TIER_COLOR: Record<string, string> = {
  IRON: "#6b7280",
  BRONZE: "#92400e",
  SILVER: "#94a3b8",
  GOLD: "#d97706",
  PLATINUM: "#10b981",
  EMERALD: "#34d399",
  DIAMOND: "#60a5fa",
  MASTER: "#a855f7",
  GRANDMASTER: "#ef4444",
  CHALLENGER: "#fbbf24",
};

function wrColor(wr: number) {
  if (wr >= 65) return "#4ade80";
  if (wr >= 55) return "#86efac";
  if (wr >= 50) return "#cbd5e1";
  if (wr >= 45) return "#fca5a5";
  return "#f87171";
}

function kdaColor(kda: number) {
  if (kda >= 4) return "#4ade80";
  if (kda >= 3) return "#86efac";
  if (kda >= 2) return "#cbd5e1";
  return "#fca5a5";
}

const S: Record<string, React.CSSProperties> = {
  section: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: "24px 28px",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 18,
    color: "#f1f5f9",
    letterSpacing: "-0.3px",
  },
  h3: {
    fontSize: 15,
    fontWeight: 600,
    color: "#cbd5e1",
    marginBottom: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  chip: (color: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background: color + "22",
    color: color,
    border: `1px solid ${color}44`,
    marginRight: 6,
    marginBottom: 4,
  }),
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  },
  th: {
    textAlign: "left" as const,
    color: "#64748b",
    padding: "6px 10px",
    borderBottom: "1px solid #334155",
    fontWeight: 600,
    fontSize: 12,
  },
  thR: {
    textAlign: "right" as const,
    color: "#64748b",
    padding: "6px 10px",
    borderBottom: "1px solid #334155",
    fontWeight: 600,
    fontSize: 12,
  },
  td: {
    padding: "7px 10px",
    borderBottom: "1px solid #1e293b",
    color: "#cbd5e1",
  },
  tdR: {
    padding: "7px 10px",
    borderBottom: "1px solid #1e293b",
    color: "#cbd5e1",
    textAlign: "right" as const,
  },
  bullet: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 1.6,
    paddingLeft: 4,
  },
  tag: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    marginRight: 6,
    marginBottom: 4,
  },
  draftRow: {
    display: "flex",
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
    flexWrap: "wrap" as const,
  },
  draftLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    width: 40,
    flexShrink: 0,
  },
  draftBan: (active: boolean): React.CSSProperties => ({
    padding: "4px 12px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    background: active ? "#7f1d1d" : "#1e293b",
    border: `1px solid ${active ? "#ef444466" : "#334155"}`,
    color: active ? "#fca5a5" : "#64748b",
    textDecoration: active ? "line-through" : "none",
    display: "flex",
    alignItems: "center",
    gap: 4,
  }),
  draftPick: (team: "blue" | "red"): React.CSSProperties => ({
    padding: "4px 14px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    background: team === "blue" ? "#1d3461" : "#461d1d",
    border: `1px solid ${team === "blue" ? "#3b82f666" : "#ef444466"}`,
    color: team === "blue" ? "#93c5fd" : "#fca5a5",
  }),
};

function PlayerCard({ p, highlight }: { p: PlayerEntry; highlight?: boolean }) {
  const roleColor = ROLE_COLOR[p.role] ?? "#94a3b8";
  const tierClr = TIER_COLOR[p.tier.toUpperCase()] ?? "#94a3b8";

  return (
    <div
      style={{
        background: highlight ? "#0f1f3d" : "#0f172a",
        border: `1px solid ${highlight ? "#3b82f666" : "#334155"}`,
        borderRadius: 10,
        padding: "18px 20px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginRight: 10 }}>{p.name}</span>
          <span style={S.chip(roleColor)}>{p.role}</span>
          {highlight && <span style={{ ...S.tag, background: "#1e3a5f", color: "#60a5fa", border: "1px solid #3b82f644" }}>⚠ THREAT</span>}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
          <span style={{ color: tierClr, fontWeight: 700 }}>{p.tier} {p.rank}</span>
          <span style={{ color: "#64748b" }}>{p.lp} LP</span>
          <span style={{ color: "#64748b" }}>{p.games} games</span>
          <span style={{ color: wrColor(p.wr), fontWeight: 600 }}>{p.wr}% WR</span>
          <span style={{ color: kdaColor(p.kda), fontWeight: 600 }}>{p.kda} KDA</span>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12, lineHeight: 1.6 }}>{p.playstyle}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={S.h3}>Strengths / Threats</div>
          {p.threats.map((t, i) => (
            <div key={i} style={S.bullet}>• {t}</div>
          ))}
        </div>
        <div>
          <div style={S.h3}>Weaknesses</div>
          {p.weaknesses.map((w, i) => (
            <div key={i} style={S.bullet}>• {w}</div>
          ))}
        </div>
      </div>

      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Champion</th>
            <th style={S.thR}>Games</th>
            <th style={S.thR}>Win Rate</th>
            <th style={S.thR}>KDA</th>
            <th style={S.thR}>Avg Dmg</th>
            <th style={S.thR}>Avg CS</th>
            <th style={S.th}>Note</th>
          </tr>
        </thead>
        <tbody>
          {p.champs.map((c, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#ffffff08" }}>
              <td style={{ ...S.td, fontWeight: 600, color: "#e2e8f0" }}>{c.name}</td>
              <td style={S.tdR}>{c.games}</td>
              <td style={{ ...S.tdR, color: wrColor(c.wr), fontWeight: 600 }}>{c.wr}%</td>
              <td style={{ ...S.tdR, color: kdaColor(c.kda) }}>{c.kda}</td>
              <td style={S.tdR}>{c.avgDmg.toLocaleString()}</td>
              <td style={S.tdR}>{c.avgCs}</td>
              <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>{c.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Draft order: Phase1 bans alternate Blue/Red x3. Picks: B1 R1 R2 B2 B3 R3.
// Phase2 bans alternate Red/Blue x2. Picks: R4 B4 B5 R5.
interface DraftSimProps {
  title: string;
  ctSide: "Blue" | "Red";
  scenario: string;
  opponentName?: string;
  // 6 bans in pick order: [Blue1, Red1, Blue2, Red2, Blue3, Red3]
  p1Bans: string[];
  // 6 picks in pick order: [B1, R1, R2, B2, B3, R3]
  p1Picks: { champ: string; role: string }[];
  // 4 bans in pick order: [Red1, Blue1, Red2, Blue2]
  p2Bans: string[];
  // 4 picks in pick order: [R4, B4, B5, R5]
  p2Picks: { champ: string; role: string }[];
  notes: string[];
}

function DraftSim({ title, ctSide, scenario, opponentName = "HeyYouGuys!", p1Bans, p1Picks, p2Bans, p2Picks, notes }: DraftSimProps) {
  const ctIsBlue = ctSide === "Blue";
  // which team acts at each step
  // p1Bans: positions 0,2,4 = Blue; 1,3,5 = Red
  const p1BanTeams: ("CT" | "HYG")[] = [0, 1, 2, 3, 4, 5].map(i =>
    (i % 2 === 0) === ctIsBlue ? "CT" : "HYG"
  );
  // p1Picks: B1=Blue, R1=Red, R2=Red, B2=Blue, B3=Blue, R3=Red
  const p1PickTeams: ("CT" | "HYG")[] = ["B", "R", "R", "B", "B", "R"].map(s =>
    (s === "B") === ctIsBlue ? "CT" : "HYG"
  );
  const p1PickLabels = ctIsBlue
    ? ["B1", "R1", "R2", "B2", "B3", "R3"]
    : ["B1", "R1", "R2", "B2", "B3", "R3"];
  // p2Bans: positions 0,2 = Red; 1,3 = Blue
  const p2BanTeams: ("CT" | "HYG")[] = [0, 1, 2, 3].map(i =>
    (i % 2 === 0) !== ctIsBlue ? "CT" : "HYG"
  );
  // p2Picks: R4=Red, B4=Blue, B5=Blue, R5=Red
  const p2PickTeams: ("CT" | "HYG")[] = ["R", "B", "B", "R"].map(s =>
    (s === "B") === ctIsBlue ? "CT" : "HYG"
  );
  const p2PickLabels = ctIsBlue
    ? ["R4", "B4", "B5", "R5"]
    : ["R4", "B4", "B5", "R5"];

  const ctClr = ctIsBlue ? "#3b82f6" : "#ef4444";
  const hygClr = ctIsBlue ? "#ef4444" : "#3b82f6";

  function teamColor(team: "CT" | "HYG") {
    return team === "CT" ? ctClr : hygClr;
  }

  function BanChip({ champ, team }: { champ: string; team: "CT" | "HYG" }) {
    const c = teamColor(team);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: c, letterSpacing: "0.3px" }}>{team}</span>
        <span style={{ padding: "3px 9px", borderRadius: 5, fontSize: 12, fontWeight: 600, background: "#7f1d1d", border: "1px solid #ef444455", color: "#fca5a5", textDecoration: "line-through" }}>{champ}</span>
      </div>
    );
  }

  function PickChip({ champ, role, team, label }: { champ: string; role: string; team: "CT" | "HYG"; label: string }) {
    const c = teamColor(team);
    const bg = team === "CT" ? (ctIsBlue ? "#1a2d50" : "#3d1a1a") : (ctIsBlue ? "#3d1a1a" : "#1a2d50");
    const border = team === "CT" ? (ctIsBlue ? "#3b82f655" : "#ef444455") : (ctIsBlue ? "#ef444455" : "#3b82f655");
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>{label}</span>
        <span style={{ padding: "4px 10px", borderRadius: 5, fontSize: 12, fontWeight: 600, background: bg, border: `1px solid ${border}`, color: c }}>{champ}</span>
        <span style={{ fontSize: 10, color: ROLE_COLOR[role] ?? "#64748b", fontWeight: 600 }}>{role}</span>
      </div>
    );
  }

  return (
    <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{title}</span>
        <span style={{ ...S.tag, background: ctIsBlue ? "#1d3461" : "#461d1d", color: ctIsBlue ? "#93c5fd" : "#fca5a5", border: `1px solid ${ctIsBlue ? "#3b82f644" : "#ef444444"}` }}>
          CT {ctSide} Side
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{scenario}</p>

      {/* Phase 1 Bans */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.6px" }}>Phase 1 — Bans</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {p1Bans.map((champ, i) => <BanChip key={i} champ={champ} team={p1BanTeams[i]} />)}
        </div>
      </div>

      {/* Phase 1 Picks */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.6px" }}>Phase 1 — Picks</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {p1Picks.map((p, i) => <PickChip key={i} champ={p.champ} role={p.role} team={p1PickTeams[i]} label={p1PickLabels[i]} />)}
        </div>
      </div>

      {/* Phase 2 Bans */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.6px" }}>Phase 2 — Bans</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {p2Bans.map((champ, i) => <BanChip key={i} champ={champ} team={p2BanTeams[i]} />)}
        </div>
      </div>

      {/* Phase 2 Picks */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.6px" }}>Phase 2 — Picks</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {p2Picks.map((p, i) => <PickChip key={i} champ={p.champ} role={p.role} team={p2PickTeams[i]} label={p2PickLabels[i]} />)}
        </div>
      </div>

      {/* Final comps summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14, padding: "12px 14px", background: "#0d1525", borderRadius: 8, border: "1px solid #1e293b" }}>
        {(["CT", "HYG"] as const).map(team => {
          const allPicks = [
            ...p1Picks.map((p, i) => ({ ...p, team: p1PickTeams[i] })),
            ...p2Picks.map((p, i) => ({ ...p, team: p2PickTeams[i] })),
          ].filter(p => p.team === team);
          const c = teamColor(team);
          return (
            <div key={team}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{team === "CT" ? "Collision Time" : opponentName}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {allPicks.map((p, i) => (
                  <span key={i} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "#1e293b", color: "#cbd5e1" }}>
                    <span style={{ color: ROLE_COLOR[p.role] ?? "#64748b", fontWeight: 700, marginRight: 4 }}>{p.role}</span>{p.champ}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid #1e293b", paddingTop: 12 }}>
        <div style={S.h3}>Draft Logic</div>
        {notes.map((n, i) => (
          <div key={i} style={S.bullet}>• {n}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Week 1 Data ──────────────────────────────────────────────────────────────

const HYG_PLAYERS: PlayerEntry[] = [
  {
    name: "HYGSmoothy",
    role: "TOP",
    tier: "PLATINUM",
    rank: "II",
    lp: 13,
    games: 13,
    wr: 53.8,
    kda: 2.37,
    avgDmg: 27128,
    avgCs: 196.1,
    playstyle:
      "Tank/bruiser focused top laner with a short ranked history in the role. Gravitates toward durable, engage-heavy picks. Low sample size (13 ranked top games) makes reads difficult — expect variance.",
    threats: [
      "Cho'Gath and Sion provide strong teamfight presence and ult value",
      "Leona top — unusual pick, 2/2 wins, shows willingness to flex engage into top",
      "Currently on a hot streak in solo queue",
    ],
    weaknesses: [
      "Shallow champion pool — only 13 games at top in ranked, high variability",
      "No clear carry threat — low average damage (27k) for a top laner",
      "Plat II is the lowest elo among HYG front-to-back, below Bonkers and MarBrah",
    ],
    champs: [
      { name: "Mordekaiser", games: 2, wr: 50, kda: 1.77, avgDmg: 24718, avgCs: 236, note: "Safe flex pick" },
      { name: "Leona", games: 2, wr: 100, kda: 2.4, avgDmg: 12409, avgCs: 136, note: "Top lane engage cheese" },
      { name: "Cho'Gath", games: 2, wr: 50, kda: 3.56, avgDmg: 33979, avgCs: 183, note: "High ult value" },
      { name: "Sion", games: 1, wr: 0, kda: 2.67, avgDmg: 46588, avgCs: 212 },
      { name: "Nasus", games: 1, wr: 100, kda: 2.5, avgDmg: 23097, avgCs: 170, note: "Scaling/split push" },
      { name: "Jax", games: 1, wr: 100, kda: 1.0, avgDmg: 17488, avgCs: 206 },
    ],
  },
  {
    name: "HYG Bonkers",
    role: "JGL",
    tier: "EMERALD",
    rank: "III",
    lp: 1,
    games: 105,
    wr: 52.4,
    kda: 2.59,
    avgDmg: 27096,
    avgCs: 205.2,
    playstyle:
      "AP-oriented jungler with Sylas as a clear primary. High sample of 105 ranked jungle games provides reliable reads. Prefers carry junglers over pure tanks — Sylas, Lee Sin, Wukong. Elise and Nocturne show strong win rates when he pops off. Plays a proactive, skirmish-heavy style.",
    threats: [
      "Sylas (26g, 61.5% WR) — his signature pick, punishes AP-heavy comps with ability steal",
      "Elise (4g, 100% WR) — undefeated, very high damage output (35k avg)",
      "Nocturne (3g, 66.7%) — global presence, synergizes with Bonkers' aggressive style",
      "Nunu (3g, 100%) — pairs perfectly with hypercarries; wills Bonkers to snowball bot",
      "Wide pool overall — hard to fully ban out, 20+ champs played at jungle",
    ],
    weaknesses: [
      "MonkeyKing is a frequent pick but underperforms (10g, 40% WR)",
      "Vi (6g, 33.3%) and XinZhao (3g, 0%) show poor results on aggressive engage junglers",
      "Performs worst when forced onto simple frontline junglers — JarvanIV 23% WR in CT's data (relevant teammate parallel)",
    ],
    champs: [
      { name: "Sylas", games: 26, wr: 61.5, kda: 2.93, avgDmg: 26954, avgCs: 208.3, note: "Primary — must-ban consideration" },
      { name: "Wukong", games: 10, wr: 40, kda: 2.82, avgDmg: 22129, avgCs: 191.2 },
      { name: "Lee Sin", games: 8, wr: 50, kda: 2.79, avgDmg: 25886, avgCs: 191 },
      { name: "Vi", games: 6, wr: 33.3, kda: 2.51, avgDmg: 23958, avgCs: 193.7, note: "Below avg WR" },
      { name: "Kayn", games: 4, wr: 50, kda: 2.22, avgDmg: 29399, avgCs: 222.3 },
      { name: "Elise", games: 4, wr: 100, kda: 5.11, avgDmg: 34903, avgCs: 229.3, note: "Undefeated — dangerous" },
      { name: "Nocturne", games: 3, wr: 66.7, kda: 4.55, avgDmg: 36444, avgCs: 209.3 },
      { name: "Nunu", games: 3, wr: 100, kda: 4.77, avgDmg: 23521, avgCs: 168.7, note: "Bot-lane enabler" },
      { name: "Viego", games: 3, wr: 100, kda: 1.7, avgDmg: 26199, avgCs: 242.3 },
      { name: "JarvanIV", games: 3, wr: 33.3, kda: 2.0, avgDmg: 18368, avgCs: 204.3 },
    ],
  },
  {
    name: "HYG MarBrah",
    role: "MID",
    tier: "EMERALD",
    rank: "I",
    lp: 60,
    games: 176,
    wr: 54,
    kda: 2.39,
    avgDmg: 26701,
    avgCs: 192.6,
    playstyle:
      "The highest-elo player on HYG and their strongest individual threat. Wide mage pool centered on Ahri, Sylas, Hwei, and Viktor. Viktor is his most dangerous pick at 72.7% WR across 11 games. Prefers champions with strong roam or global presence. The captain of HYG — expect him to be the primary carry threat.",
    threats: [
      "Viktor (11g, 72.7% WR) — exceptional performance, must ban consideration",
      "Yone (6g, 83.3% WR) — small sample but dominant when played",
      "Galio (7g, 71.4% WR) — anti-AP flex with roam; synergizes with Bonkers' engage",
      "Malzahar (9g, 66.7%) — strong late-game suppression, reliable pick",
      "Sylas (24g, 62.5% WR) — doubles as both his pocket and Bonkers' pocket; banning Sylas hurts both",
      "Emerald I is HYG's highest elo — he will outscale most matchups if given space",
    ],
    weaknesses: [
      "Twisted Fate (16g, 37.5% WR) — frequent pick, poor results; punishable if he falls back on it",
      "Locke (3g, 0% WR) — 0% on this champ, clearly out of his comfort zone",
      "Average KDA (2.39) is lower than expected for his elo — inconsistent carry performance",
      "Hive (Gold I) has a significant elo disadvantage into MarBrah",
    ],
    champs: [
      { name: "Ahri", games: 29, wr: 55.2, kda: 2.83, avgDmg: 23191, avgCs: 190.3, note: "Most-played" },
      { name: "Sylas", games: 24, wr: 62.5, kda: 2.49, avgDmg: 27500, avgCs: 162.6, note: "Shared with Bonkers — high priority ban" },
      { name: "Hwei", games: 23, wr: 52.2, kda: 2.87, avgDmg: 32756, avgCs: 224.5, note: "High damage output" },
      { name: "TwistedFate", games: 16, wr: 37.5, kda: 2.19, avgDmg: 22047, avgCs: 185.6, note: "Overplayed, bad WR" },
      { name: "Viktor", games: 11, wr: 72.7, kda: 2.51, avgDmg: 28406, avgCs: 186.9, note: "PRIORITY BAN" },
      { name: "Malzahar", games: 9, wr: 66.7, kda: 2.21, avgDmg: 25359, avgCs: 221.6 },
      { name: "Galio", games: 7, wr: 71.4, kda: 2.78, avgDmg: 21987, avgCs: 171.1, note: "AP counter + roam" },
      { name: "Yone", games: 6, wr: 83.3, kda: 2.18, avgDmg: 27243, avgCs: 201.8, note: "Small sample, dominant" },
      { name: "LeBlanc", games: 5, wr: 40, kda: 3.17, avgDmg: 27391, avgCs: 189.8 },
      { name: "Aurora", games: 5, wr: 40, kda: 2.73, avgDmg: 30435, avgCs: 190.4 },
    ],
  },
  {
    name: "HYGJefferyCrazy",
    role: "BOT",
    tier: "SILVER",
    rank: "I",
    lp: 70,
    games: 21,
    wr: 61.9,
    kda: 3.09,
    avgDmg: 33746,
    avgCs: 203.8,
    playstyle:
      "ADC with a small ranked sample (21 games). The weakest elo link on HYG at Silver I. However, he shows high win rate in the small sample — could be climbing. Primarily plays comfort ADCs: Ezreal, Jinx, Caitlyn. Note that his support Fatboywowa plays Yuumi, which means Jeffery needs to be self-sufficient since Yuumi detaches in difficult situations.",
    threats: [
      "Jinx (4g, 75% WR) — strong lategame carry threat if he gets there",
      "Caitlyn (3g, 66.7%) — poke lane with Yuumi or Seraphine is strong early",
      "Small sample inflates win rate — don't overweight the 61.9% WR",
      "Varus (1g, 100%) and Jhin (1g, 100%) show range flexibility",
    ],
    weaknesses: [
      "Silver I is the weakest rank on HYG — Nekter (Silver I) should have parity or edge depending on form",
      "Ezreal (6g, 50%) is his most-played but results are average",
      "MissFortune (3g, 33.3%) performed poorly",
      "Playing with Yuumi support means he needs to play more independently under pressure",
      "Very small sample — comfort zone is not well established",
    ],
    champs: [
      { name: "Ezreal", games: 6, wr: 50, kda: 2.82, avgDmg: 39031, avgCs: 221.3, note: "Most-played" },
      { name: "Jinx", games: 4, wr: 75, kda: 3.15, avgDmg: 31621, avgCs: 209 },
      { name: "MissFortune", games: 3, wr: 33.3, kda: 2.0, avgDmg: 26781, avgCs: 226.3 },
      { name: "Caitlyn", games: 3, wr: 66.7, kda: 3.65, avgDmg: 33607, avgCs: 190.7 },
      { name: "Ziggs", games: 2, wr: 100, kda: 2.59, avgDmg: 38074, avgCs: 165 },
      { name: "Varus", games: 1, wr: 100, kda: 10, avgDmg: 32914, avgCs: 225 },
      { name: "Jhin", games: 1, wr: 100, kda: 10, avgDmg: 37463, avgCs: 180 },
    ],
  },
  {
    name: "HYG Fatboywowa67",
    role: "SUP",
    tier: "GOLD",
    rank: "II",
    lp: 3,
    games: 66,
    wr: 50,
    kda: 3.01,
    avgDmg: 12641,
    avgCs: 47.2,
    playstyle:
      "Passive enchanter/poke support built around Yuumi. Over 40% of his games are Yuumi — a taxi playstyle that lives or dies by the ADC's performance. Seraphine is a meaningful secondary offering range poke and team utility. Rarely plays hard engage supports (Nautilus, Leona, Rell are in his pool but infrequent).",
    threats: [
      "Yuumi (27g) — if JefferyCrazy gets rolling, Yuumi shields and heals on top of auto-attacks",
      "Seraphine (18g, 55.6%) — poke + ult can chain into Bonkers' CC for picks",
      "Lux (3g, 100%) — undefeated in small sample, long-range poke threat",
    ],
    weaknesses: [
      "Yuumi (48.1% WR) — sub-50% win rate on his primary; heavy reliance on ADC performance",
      "Gold II is below the average HYG player rank",
      "Soraka (2g, 0%), Blitzcrank (1g, 0%), Braum (1g not in top range), Leona (1g, 0%) — poor results on engage/non-enchanters",
      "Yuumi is a popular ban target — gets removed from the game frequently",
      "If Yuumi is banned, his next best options (Seraphine, Morgana) are less dominant",
    ],
    champs: [
      { name: "Yuumi", games: 27, wr: 48.1, kda: 5.11, avgDmg: 9126, avgCs: 12.2, note: "Primary — ban removes his identity" },
      { name: "Seraphine", games: 18, wr: 55.6, kda: 2.56, avgDmg: 15140, avgCs: 85.6 },
      { name: "Morgana", games: 4, wr: 50, kda: 1.75, avgDmg: 18100, avgCs: 63 },
      { name: "Lux", games: 3, wr: 100, kda: 2.38, avgDmg: 18299, avgCs: 52.7 },
      { name: "Nautilus", games: 2, wr: 50, kda: 2.21, avgDmg: 24953, avgCs: 46 },
      { name: "Rell", games: 2, wr: 50, kda: 2.33, avgDmg: 9447, avgCs: 34.5 },
    ],
  },
];

const CT_PLAYERS: PlayerEntry[] = [
  {
    name: "Ransom",
    role: "TOP",
    tier: "SILVER",
    rank: "I",
    lp: 1,
    games: 69,
    wr: 53.6,
    kda: 2.13,
    avgDmg: 24434,
    avgCs: 198.5,
    playstyle: "Teamfight-focused tank top with a dominant Malphite comfort. Supplements with Jax and Cho'Gath for more flexible lane matchups. Sion and Olaf offer additional frontline options.",
    threats: ["Malphite (20g, 70% WR) — exceptionally high win rate, priority pick when available", "Olaf (4g, 75%) — strong diver against the tanks HYG plays", "Nasus (3g, 66.7%) — splitpush threat if game goes long"],
    weaknesses: ["Silver I is below Smoothy (Plat II) — potential lane disadvantage", "Cho'Gath (9g, 33.3% WR) — frequently played, bad results", "Jax (11g, 45.5%) — most-played champ outside Malphite but below 50% WR"],
    champs: [
      { name: "Malphite", games: 20, wr: 70, kda: 3.48, avgDmg: 27707, avgCs: 201.6, note: "Signature — prioritize" },
      { name: "Jax", games: 11, wr: 45.5, kda: 1.53, avgDmg: 23685, avgCs: 184.5 },
      { name: "Cho'Gath", games: 9, wr: 33.3, kda: 1.75, avgDmg: 23816, avgCs: 175.1, note: "Avoid" },
      { name: "Yorick", games: 5, wr: 60, kda: 1.14, avgDmg: 18388, avgCs: 207.8 },
      { name: "Olaf", games: 4, wr: 75, kda: 3.14, avgDmg: 27000, avgCs: 199.8 },
      { name: "Sion", games: 4, wr: 75, kda: 2.53, avgDmg: 15169, avgCs: 200 },
      { name: "Nasus", games: 3, wr: 66.7, kda: 3.73, avgDmg: 30758, avgCs: 220.7 },
    ],
  },
  {
    name: "Oxymoronical",
    role: "JGL",
    tier: "EMERALD",
    rank: "III",
    lp: 78,
    games: 286,
    wr: 53.1,
    kda: 2.7,
    avgDmg: 26021,
    avgCs: 214.1,
    playstyle: "CT's most experienced jungler by sample size. Nocturne is the primary — the 78.1% WR across 32 games is elite. Scaling champions (Nasus, Shyvana) are a core part of his identity. Also plays Kayn, Viego, and Jayce jungle for flexibility.",
    threats: ["Nocturne (32g, 78.1% WR) — dominant, should pick whenever available", "Nasus (19g, 73.7%) — unstoppable scaling, coordinate baron/objectives", "Shyvana (16g, 68.8%) — dragon-soul speedrun strategy", "Ambessa (9g, 55.6%) — newer pick showing promise"],
    weaknesses: ["Lee Sin (17g, 41.2%) and JarvanIV (13g, 23.1%) — avoid these vs HYG", "Viego (20g, 45%) — below average despite high play rate", "Graves (14g, 28.6%) — frequently played but very poor results"],
    champs: [
      { name: "Nocturne", games: 32, wr: 78.1, kda: 3.45, avgDmg: 29725, avgCs: 233.3, note: "PRIORITY PICK" },
      { name: "Nasus", games: 19, wr: 73.7, kda: 3.94, avgDmg: 25163, avgCs: 197.4, note: "Scaling monster" },
      { name: "Shyvana", games: 16, wr: 68.8, kda: 4.05, avgDmg: 27245, avgCs: 235.6 },
      { name: "Kayn", games: 19, wr: 52.6, kda: 2.35, avgDmg: 27317, avgCs: 205.8 },
      { name: "Volibear", games: 14, wr: 57.1, kda: 2.78, avgDmg: 23526, avgCs: 201.8 },
      { name: "Qiyana", games: 11, wr: 63.6, kda: 2.01, avgDmg: 22983, avgCs: 221.1 },
      { name: "Diana", games: 9, wr: 55.6, kda: 2.96, avgDmg: 27001, avgCs: 248.1 },
    ],
  },
  {
    name: "HiveTheBhenchod",
    role: "MID",
    tier: "GOLD",
    rank: "I",
    lp: 32,
    games: 293,
    wr: 53.2,
    kda: 2.9,
    avgDmg: 27617,
    avgCs: 201.1,
    playstyle: "Deep-pool mage with Viktor as the clear primary (80 games). Syndra, Orianna, and Veigar round out a consistent scaling mage identity. Fizz gives him an assassin flex. High game volume (293 games) means reliable champion pools are well-established.",
    threats: ["Viktor (80g, 56.3% WR) — signature pick, massive game count, reliable", "Syndra (54g, 57.4%) — strong pick rate and win rate", "Veigar (32g, 59.4%) — snowball threat, punishes AFK scaling", "Ziggs (15g, 60%) — poke/waveclear, good vs melee mids"],
    weaknesses: ["Orianna (72g, 47.2%) — most played after Viktor but below 50% WR", "Gold I faces Emerald I MarBrah — expect a difficult lane", "Fizz (28g, 50%) — inconsistent results on the carry assassin"],
    champs: [
      { name: "Viktor", games: 80, wr: 56.3, kda: 3.08, avgDmg: 33596, avgCs: 206.6, note: "Lock in if not banned" },
      { name: "Orianna", games: 72, wr: 47.2, kda: 2.79, avgDmg: 23648, avgCs: 203.6, note: "High play rate, weak WR" },
      { name: "Syndra", games: 54, wr: 57.4, kda: 2.88, avgDmg: 28831, avgCs: 200.1 },
      { name: "Veigar", games: 32, wr: 59.4, kda: 3.13, avgDmg: 24572, avgCs: 206.5 },
      { name: "Fizz", games: 28, wr: 50, kda: 2.65, avgDmg: 22496, avgCs: 175.4 },
      { name: "Ziggs", games: 15, wr: 60, kda: 3.38, avgDmg: 31492, avgCs: 215.3 },
    ],
  },
  {
    name: "Nekter",
    role: "BOT",
    tier: "SILVER",
    rank: "I",
    lp: 75,
    games: 219,
    wr: 46.6,
    kda: 2.17,
    avgDmg: 35054,
    avgCs: 178.3,
    playstyle: "Wide-pool ADC with exceptional Twitch and Ashe performance buried in an otherwise inconsistent history. Kaisa, Vayne, and Xayah are the highest-volume picks. Concerningly also plays Thresh in the bot role at a poor win rate — avoid in tournament play.",
    threats: ["Twitch (14g, 78.6% WR) — his best pick by a huge margin, pocket ace", "Ashe (13g, 69.2%) — consistent poke and engage utility, underrated pick", "High average damage (35k) — capable of outputting top-tier DPS when ahead"],
    weaknesses: ["Overall 46.6% WR — below 50%, losing record in ranked solo", "Thresh in bot (18g, 33.3%) — drastically hurts bot lane when played", "Samira (8g, 25%), Aphelios (5g, 20%) — aggressive carries performed poorly", "Lacks reliable comfort pick outside Twitch/Ashe"],
    champs: [
      { name: "Twitch", games: 14, wr: 78.6, kda: 2.58, avgDmg: 43784, avgCs: 185.7, note: "POCKET ACE — hide pick" },
      { name: "Ashe", games: 13, wr: 69.2, kda: 2.27, avgDmg: 32644, avgCs: 195.1 },
      { name: "Kaisa", games: 31, wr: 51.6, kda: 2.48, avgDmg: 39262, avgCs: 205.4, note: "Most-played" },
      { name: "Vayne", games: 29, wr: 51.7, kda: 2.28, avgDmg: 42863, avgCs: 193.5 },
      { name: "Xayah", games: 22, wr: 45.5, kda: 2.5, avgDmg: 39195, avgCs: 209.3 },
      { name: "Tristana", games: 18, wr: 50, kda: 2.2, avgDmg: 29667, avgCs: 175.1 },
      { name: "Lucian", games: 11, wr: 45.5, kda: 2.14, avgDmg: 33767, avgCs: 207.4 },
    ],
  },
  {
    name: "Hond",
    role: "SUP",
    tier: "GOLD",
    rank: "II",
    lp: 76,
    games: 76,
    wr: 47.4,
    kda: 2.48,
    avgDmg: 16956,
    avgCs: 44.1,
    playstyle: "Lux is the primary — 19 games with 52.6% WR shows comfort on long-range poke/CC. Blitzcrank is a frequent second pick offering hook threat. Milio and Braum are smaller sample standouts. Zyra is played frequently but has a 28.6% WR — avoid.",
    threats: ["Blitzcrank — hook threat; if he lands, it's often a free kill", "Milio (3g, 66.7%) and Braum (3g, 66.7%) — small sample, promising results", "Lux (19g, 52.6%) — long-range poke + root; pairs well with Nekter's scaling ADCs"],
    weaknesses: ["Overall 47.4% WR — below 50%", "Zyra (7g, 28.6%) — frequently reaches for but rarely wins", "Blitzcrank (10g, 40%) — hook threat but below average WR", "Enchanter/heal options limited — Milio and Sona infrequent"],
    champs: [
      { name: "Lux", games: 19, wr: 52.6, kda: 2.57, avgDmg: 24387, avgCs: 55.9, note: "Primary" },
      { name: "Blitzcrank", games: 10, wr: 40, kda: 2.8, avgDmg: 11904, avgCs: 23.7 },
      { name: "Zyra", games: 7, wr: 28.6, kda: 2.1, avgDmg: 23565, avgCs: 42.3, note: "Avoid — poor WR" },
      { name: "Sona", games: 5, wr: 60, kda: 2.27, avgDmg: 11948, avgCs: 20.6 },
      { name: "Amumu", games: 4, wr: 50, kda: 2.4, avgDmg: 18947, avgCs: 54.8 },
      { name: "Milio", games: 3, wr: 66.7, kda: 4.95, avgDmg: 9015, avgCs: 21.7 },
      { name: "Braum", games: 3, wr: 66.7, kda: 3.58, avgDmg: 8369, avgCs: 32.3 },
    ],
  },
];

const CT_OPGG = "https://op.gg/lol/multisearch/na?summoners=Ransom%23rnsm%2COxymoronical%23na1%2CHiveTheBhenchod%23hive%2CNekter%23na1%2CHond%23na1";
const HYG_OPGG = "https://op.gg/lol/multisearch/na?summoners=HYGSmoothy%23HYG%2CHYG%20Bonkers%23HYG%2CHYG%20MarBrah%23HYG%2CHYGJefferyCrazy%23NA1%2CHYG%20Fatboywowa67%23HYG";

function OpggLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 12px",
        borderRadius: 20,
        background: "#c8102e",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        textDecoration: "none",
        letterSpacing: 0.3,
      }}
    >
      {label} op.gg ↗
    </a>
  );
}

// ─── Week 1 Write-Up Component ─────────────────────────────────────────────────

function Week1() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Week 1 — Lugia Division</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#f1f5f9", margin: 0, letterSpacing: "-0.5px" }}>
          Collision Time <span style={{ color: "#3b82f6" }}>vs.</span> HeyYouGuys!
        </h1>
        <p style={{ color: "#64748b", marginTop: 8, marginBottom: 14, fontSize: 15 }}>Scouting report, ban priorities, and draft simulations</p>
        <div style={{ display: "flex", gap: 10 }}>
          <OpggLink href={CT_OPGG} label="Collision Time" />
          <OpggLink href={HYG_OPGG} label="HeyYouGuys!" />
        </div>
      </div>

      {/* TL;DR */}
      <div style={{ ...S.section, background: "#162032", borderColor: "#1e3a5f" }}>
        <div style={S.sectionTitle}>TL;DR — Key Takeaways</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>HYG Threat Tier</div>
            {[
              { name: "MarBrah (MID)", tier: "S", reason: "Emer I, Viktor 72.7% WR, Sylas, Ahri — widest pool" },
              { name: "Bonkers (JGL)", tier: "A", reason: "Emer III, Sylas specialist, Elise undefeated" },
              { name: "Fatboywowa67 (SUP)", tier: "B", reason: "Gold II, Yuumi/Seraphine — scales with ADC" },
              { name: "Smoothy (TOP)", tier: "C", reason: "Plat II, small sample, no carry threat" },
              { name: "JefferyCrazy (BOT)", tier: "D", reason: "Silver I, 21 ranked games — exploitable lane" },
            ].map((t) => (
              <div key={t.name} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: t.tier === "S" ? "#f87171" : t.tier === "A" ? "#fb923c" : t.tier === "B" ? "#fbbf24" : t.tier === "C" ? "#94a3b8" : "#64748b", width: 18, flexShrink: 0 }}>{t.tier}</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>{t.name}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}> — {t.reason}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>CT Advantages to Play To</div>
            {[
              "Oxymoronical's Nocturne (78.1% WR) can dominate the map if not banned",
              "Ransom's Malphite (70% WR) is a teamfight anchor and easy to execute",
              "Nekter's Twitch (78.6% WR) is a pocket pick HYG won't see coming",
              "Hive's Viktor is the same elo threat MarBrah plays — denying it hurts HYG more",
              "JefferyCrazy is Silver I — pressure bot early to snowball Nekter",
            ].map((a, i) => (
              <div key={i} style={S.bullet}>• {a}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>CT Risk Factors</div>
            {[
              "Hive (Gold I) is at a raw elo disadvantage vs MarBrah (Emer I)",
              "MarBrah's wide pool is hard to fully ban out in 3 ban phases",
              "Bonkers has a 500-game account — he has deep familiarity at Jungle",
              "Yuumi + Jinx bot is a lategame landmine if CT doesn't end early",
              "Nekter's overall 46.6% WR means bot lane can't be left alone",
            ].map((a, i) => (
              <div key={i} style={S.bullet}>• {a}</div>
            ))}
          </div>
        </div>
      </div>

      {/* HYG Scouting */}
      <div style={S.section}>
        <div style={S.sectionTitle}>HeyYouGuys! — Player Profiles</div>
        {HYG_PLAYERS.map((p) => (
          <PlayerCard key={p.name} p={p} highlight={p.name === "HYG MarBrah" || p.name === "HYG Bonkers"} />
        ))}
      </div>

      {/* CT Profiles */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Collision Time — Player Profiles</div>
        {CT_PLAYERS.map((p) => (
          <PlayerCard key={p.name} p={p} />
        ))}
      </div>

      {/* Ban Priorities */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Ban Priority Guide</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={S.h3}>CT's Bans vs HYG</div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#7f1d1d", color: "#fca5a5", border: "1px solid #ef444444" }}>1. Viktor</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>72.7% WR on MarBrah — the most dangerous single pick in this matchup</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#7f1d1d", color: "#fca5a5", border: "1px solid #ef444444" }}>2. Sylas</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Used by BOTH Bonkers (62.5%) AND MarBrah (62.5%) — a single ban cripples two players</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#7f1d1d", color: "#fca5a5", border: "1px solid #ef444444" }}>3. Yuumi</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Removes Fatboywowa's identity pick; forces him onto less optimal champions</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#78350f", color: "#fde68a", border: "1px solid #f59e0b44" }}>4. Ahri / Hwei</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>MarBrah's volume picks — if Viktor and Sylas are banned, take one of these</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#78350f", color: "#fde68a", border: "1px solid #f59e0b44" }}>5. Galio</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>71.4% WR on MarBrah; hard counters Viktor/Hive's mage pool if CT picks that direction</span>
            </div>
          </div>

          <div>
            <div style={S.h3}>HYG's Likely Bans vs CT</div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#1a1a2e", color: "#94a3b8", border: "1px solid #33415566" }}>Expected: Nocturne</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Oxymoronical's 78.1% WR will be scouted</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#1a1a2e", color: "#94a3b8", border: "1px solid #33415566" }}>Expected: Viktor</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Hive's signature — they'll want to deny it</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#1a1a2e", color: "#94a3b8", border: "1px solid #33415566" }}>Expected: Malphite</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Ransom's 70% WR pick is a known terror vs AP comps</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#1a1a2e", color: "#94a3b8", border: "1px solid #33415566" }}>Possible: Twitch</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>If scouted — 78.6% WR is scary; hide Twitch until pick phase</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#1a1a2e", color: "#94a3b8", border: "1px solid #33415566" }}>Possible: Syndra</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Hive's 57.4% WR on 54 games is well-documented</span>
            </div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#0f172a", borderRadius: 8, border: "1px solid #334155" }}>
              <span style={{ fontSize: 13, color: "#fbbf24" }}>💡 Strategic Note:</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}> If HYG bans Nocturne + Viktor + Malphite, CT should pivot to Syndra mid + Nasus or Shyvana jungle + Olaf/Sion top — all of which have high Oxy/Ransom WRs that HYG may not ban.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Playstyle Analysis */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Playstyle & Matchup Analysis</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
          <div>
            <div style={S.h3}>HYG Tendencies</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>AP-heavy composition:</b> Bonkers wants Sylas jungle, MarBrah wants AP mid, Smoothy plays Cho'Gath/Morde top — expect HYG to run double or triple AP</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Enchanter bot:</b> Yuumi/Seraphine means HYG bot lane is designed to scale — they don't want to fight early at bot</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>No consistent frontline initiator:</b> Unless Smoothy plays Leona top or Bonkers plays Vi, HYG lacks reliable hard engage</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Their win condition:</b> Get MarBrah ahead on Viktor/Sylas → roam with Bonkers → Jinx/Ezreal/Yuumi scale to lategame hypercarry</div>
          </div>
          <div>
            <div style={S.h3}>CT's Win Condition</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Gank bot early:</b> JefferyCrazy is Silver I and Fatboywowa has Yuumi — Oxymoronical can invade and camp bot repeatedly</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Deny MarBrah's best picks:</b> Ban Viktor and Sylas. Force him onto TF (37.5% WR) or Locke (0% WR)</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Teamfight composition:</b> Malphite + Nocturne (if available) + Viktor/Syndra creates an instant-engage wombo that HYG has no consistent answer to</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Play toward Nekter's Twitch:</b> Twitch is a hard-to-ban pocket. Set him up at bot with Hond's shield/peel support and he scales into a teamfight menace</div>
          </div>
        </div>

        <div style={{ padding: "14px 18px", background: "#0f172a", borderRadius: 8, border: "1px solid #334155" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Strongest vs. Weakest — HYG Assessment</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#f87171", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Strongest: MarBrah (MID)</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>Emerald I with 176 ranked mid games. Viktor at 72.7% WR is the single scariest pick in this matchup. His diversity (Yone 83%, Galio 71%, Malzahar 67%) means you can't fully ban him out. Hive is at a 2-division elo deficit going into this lane.</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#4ade80", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Weakest: JefferyCrazy (BOT)</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>Silver I with only 21 ranked BOT games. The elo gap between him and Nekter (also Silver I) is the same on paper, but Nekter has 219 games of experience at the role vs 21. His Yuumi support is also his weakness — Yuumi thrives when the ADC can 1v2 briefly, which Silver I often can't.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Draft Simulations */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Draft Simulations</div>
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
          Three simulated draft scenarios covering different side assignments and priority adjustments. These are frameworks — adapt in real time based on HYG's first picks.
        </p>

        <DraftSim
          title="Scenario A — CT Blue Side (Standard)"
          ctSide="Blue"
          scenario="Blue side means CT picks first — use that to lock Viktor for Hive before HYG can touch it. No need to waste a ban on it. Bans target Bonkers/MarBrah's shared pick (Sylas), Fatboywowa's identity (Yuumi), and MarBrah's anti-AP flex (Galio)."
          p1Bans={[
            "Sylas",      // CT Blue1: removes both Bonkers (62%) and MarBrah (62%)
            "Nocturne",   // HYG Red1: Oxy's 78% WR, expected
            "Yuumi",      // CT Blue2: removes Fatboywowa's identity pick
            "Malphite",   // HYG Red2: Ransom's 70% WR, expected
            "Galio",      // CT Blue3: MarBrah's 71% anti-AP counter
            "Syndra",     // HYG Red3: Hive's 57% on 54 games
          ]}
          p1Picks={[
            { champ: "Viktor", role: "MID" },     // CT B1: secure Hive's best pick immediately
            { champ: "Ahri", role: "MID" },       // HYG R1: MarBrah's comfort without Sylas/Galio
            { champ: "Cho'Gath", role: "TOP" },   // HYG R2: Smoothy's reliable tank
            { champ: "Shyvana", role: "JGL" },    // CT B2: Oxy 68.8% WR, dragon scaling
            { champ: "Sion", role: "TOP" },       // CT B3: Ransom 75% WR, frontline peel
            { champ: "Wukong", role: "JGL" },     // HYG R3: Bonkers forced off Sylas (40% WR)
          ]}
          p2Bans={[
            "Twitch",     // HYG Red1: if scouted, deny Nekter's pocket ace
            "Elise",      // CT Blue1: Bonkers' undefeated pocket (though he's locked, deny later flex)
            "Ashe",       // HYG Red2: deny Nekter's second-best (69.2% WR)
            "Hwei",       // CT Blue2: deny MarBrah's high-damage backup if he tries to swap
          ]}
          p2Picks={[
            { champ: "Jinx", role: "BOT" },        // HYG R4: JefferyCrazy comfort
            { champ: "Kaisa", role: "BOT" },       // CT B4: Nekter 51.6% (Twitch/Ashe banned)
            { champ: "Milio", role: "SUP" },       // CT B5: Hond 66.7% small sample, shields scaling
            { champ: "Seraphine", role: "SUP" },   // HYG R5: Fatboywowa without Yuumi
          ]}
          notes={[
            "Viktor is B1 — not banned. Blue side lets CT pick it before HYG ever gets a say. Banning it wastes a slot.",
            "Sylas ban (CT Blue1) is the real priority — one ban cripples both Bonkers AND MarBrah since both run it at 62%+ WR.",
            "With Sylas/Galio banned, MarBrah falls to Ahri (55% WR) — a downgrade from his 72% Viktor.",
            "Bonkers picks Wukong (his 40% WR pick) — a significant power drop from his Sylas main.",
            "Shyvana (Oxy) + Sion (Ransom) creates a frontline that scales into Kaisa's late-game and covers for Viktor fights.",
            "If HYG doesn't ban Twitch, switch Kaisa → Twitch (B4) and this comp becomes even stronger.",
            "Win condition: Viktor snowballs vs Ahri in mid, Shyvana secures dragon soul, Kaisa/Milio win the 5v5.",
          ]}
        />

        <DraftSim
          title="Scenario B — CT Red Side"
          ctSide="Red"
          scenario="Red side flips the Viktor problem — HYG picks first and would take it B1 for MarBrah. Now CT must ban it. Use red side's counter-pick advantage at mid: let HYG show their hand, then answer with Veigar into their forced pick."
          p1Bans={[
            "Nocturne",   // HYG Blue1: Oxy's 78% WR, expected ban
            "Viktor",     // CT Red1: must ban now — HYG would pick it as B1
            "Malphite",   // HYG Blue2: Ransom's 70% WR
            "Sylas",      // CT Red2: remove Bonkers + MarBrah's shared pocket
            "Syndra",     // HYG Blue3: Hive's 57% on 54 games
            "Ahri",       // CT Red3: MarBrah without Viktor/Sylas falls to Ahri; ban it too
          ]}
          p1Picks={[
            { champ: "Hwei", role: "MID" },       // HYG B1: MarBrah's forced pick (52% WR) without Viktor/Sylas/Ahri
            { champ: "Shyvana", role: "JGL" },    // CT R1: Oxy 68.8% WR
            { champ: "Sion", role: "TOP" },       // CT R2: Ransom 75% WR, peel for scaling
            { champ: "Jinx", role: "BOT" },       // HYG B2: JefferyCrazy comfort
            { champ: "Cho'Gath", role: "TOP" },   // HYG B3: Smoothy comfort
            { champ: "Veigar", role: "MID" },     // CT R3: counter-pick into Hwei — cage one-shots immobile Hwei at 2 items
          ]}
          p2Bans={[
            "Galio",      // CT Red1: MarBrah's anti-AP flex (would hard-counter Veigar)
            "Twitch",     // HYG Blue1: deny Nekter's known pocket if scouted
            "Elise",      // CT Red2: Bonkers' 100% WR pocket
            "Nunu",       // HYG Blue2: Oxy's 100% WR on 3 games, bot-lane enabler
          ]}
          p2Picks={[
            { champ: "Ashe", role: "BOT" },       // CT R4: Nekter 69.2% WR (Twitch banned by HYG); Ashe ult also provides engage
            { champ: "Wukong", role: "JGL" },     // HYG B4: Bonkers' best available (Sylas/Elise banned)
            { champ: "Seraphine", role: "SUP" },  // HYG B5: Fatboywowa without Yuumi
            { champ: "Lux", role: "SUP" },        // CT R5: Hond 52.6% WR on 19 games; poke + root pairs with Veigar cage
          ]}
          notes={[
            "Banning Viktor on red side is correct — HYG has B1 and would lock it for MarBrah immediately.",
            "Ahri ban (CT Red3 in phase 1) is the key move: with Viktor + Sylas + Ahri gone, MarBrah is forced onto Hwei (52% WR, down from 72%).",
            "Veigar at R3 is the counter-pick payoff: after seeing Hwei B1, CT locks Veigar — cage traps immobile Hwei, and R one-shots at 2 items.",
            "CT needs to also ban Galio in phase 2 — it's MarBrah's 71% WR anti-AP pick that would counter Veigar.",
            "Sion (Ransom) absorbs Cho'Gath ult with shield/grey health. Shyvana races dragon soul while Cho'Gath is stuck splitpushing.",
            "Lux (Hond) gives CT a second long-range root — Veigar cage + Lux Q + Veigar ult is a reliable pick combo from range.",
            "Ashe ult (R5 counter) gives CT an additional global engage tool on top of Veigar cage — HYG has no answer to chain CC.",
            "Win condition: Veigar bullies Hwei off waves, Shyvana secures dragon control, Ashe ult + Veigar cage + Lux snare wins teamfights.",
          ]}
        />

        <DraftSim
          title="Scenario C — Blue Side, HYG Bans Viktor"
          ctSide="Blue"
          scenario="HYG adapts and bans Viktor to deny Hive. CT pivots to Veigar (59% WR, 32 games) as the primary mid and shifts the bot lane to a Twitch scaling comp. Punish their ban by using blue side picks to secure CT's next tier of high-WR champions."
          p1Bans={[
            "Sylas",      // CT Blue1: always first — hits both Bonkers and MarBrah
            "Viktor",     // HYG Red1: HYG targets Hive's signature
            "Yuumi",      // CT Blue2: remove Fatboywowa's identity
            "Nocturne",   // HYG Red2: Oxy's 78% WR
            "Galio",      // CT Blue3: pre-empt MarBrah's anti-AP counter
            "Malphite",   // HYG Red3: Ransom's 70% WR
          ]}
          p1Picks={[
            { champ: "Veigar", role: "MID" },     // CT B1: Hive's 59% WR on 32 games — lock now before HYG bans it
            { champ: "Ahri", role: "MID" },       // HYG R1: MarBrah forced to Ahri without Sylas/Viktor/Galio
            { champ: "Cho'Gath", role: "TOP" },   // HYG R2: Smoothy comfort
            { champ: "Shyvana", role: "JGL" },    // CT B2: Oxy 68.8% WR, dragon scaling
            { champ: "Olaf", role: "TOP" },       // CT B3: Ransom 75% WR — Olaf ult counters Cho'Gath ult hard
            { champ: "Wukong", role: "JGL" },     // HYG R3: Bonkers forced pick (40% WR without Sylas)
          ]}
          p2Bans={[
            "Syndra",     // HYG Red1: deny Hive's next-best backup after Veigar
            "Jinx",       // CT Blue1: deny JefferyCrazy's highest WR pick (75% on 4 games)
            "Hwei",       // HYG Red2: deny Hive's Hwei as another strong backup
            "Seraphine",  // CT Blue2: force Fatboywowa to Morgana/Lux, weaker without Yuumi/Seraphine
          ]}
          p2Picks={[
            { champ: "Ezreal", role: "BOT" },     // HYG R4: JefferyCrazy falls to Ezreal (50% WR, most played)
            { champ: "Twitch", role: "BOT" },     // CT B4: Nekter's 78.6% WR pocket — hidden pick reveal
            { champ: "Milio", role: "SUP" },      // CT B5: Hond shields Twitch, enables Shyvana fights
            { champ: "Morgana", role: "SUP" },    // HYG R5: Fatboywowa's best remaining option (50% WR)
          ]}
          notes={[
            "HYG spends their ban on Viktor — good for them, but they also burn Nocturne (their most valuable ban). That's two of CT's best picks addressed but leaves Shyvana/Olaf untouched.",
            "Veigar at B1 is critical: once HYG burns their phase 1 bans on Viktor + Nocturne + Malphite, Veigar is the next thing they'd target. Lock it immediately.",
            "Olaf (Ransom, 75% WR) specifically counters Cho'Gath: Ragnarok makes Olaf CC-immune, walking through Cho'Gath ult freely.",
            "Twitch reveal at B4 is the payoff: HYG burned bans on Viktor/Nocturne instead of Twitch, so Nekter's best pick lands for free.",
            "Milio + Twitch is a scaling terror: Milio's shield and buff range empower Twitch's passive poison ticks across the whole team.",
            "Win condition: Veigar shuts down Ahri roams, Shyvana secures 2 dragon souls, Twitch/Milio win late teamfights.",
          ]}
        />
      </div>

      {/* Summary */}
      <div style={{ ...S.section, background: "#111827", borderColor: "#1e3a5f" }}>
        <div style={S.sectionTitle}>Final Recommendations</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          {[
            {
              label: "Must-Ban",
              color: "#ef4444",
              items: ["Viktor — red side only; blue side picks it B1 instead", "Sylas (both Bonkers + MarBrah, 62% WR each) — always ban this"],
            },
            {
              label: "Strong-Ban",
              color: "#f59e0b",
              items: ["Yuumi (Fatboywowa's identity)", "Ahri or Hwei (MarBrah's volume picks)", "Elise (Bonkers undefeated pocket)"],
            },
            {
              label: "CT Priority Picks",
              color: "#22c55e",
              items: [
                "Nocturne (Oxy 78.1% WR) — pick if available",
                "Malphite (Ransom 70%) — punish AP-heavy HYG",
                "Twitch (Nekter 78.6%) — hide until pick phase",
                "Shyvana (Oxy 68.8%) — dragon-path scaling comp",
              ],
            },
          ].map((col) => (
            <div key={col.label}>
              <div style={{ fontSize: 12, fontWeight: 700, color: col.color, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>{col.label}</div>
              {col.items.map((item, i) => (
                <div key={i} style={S.bullet}>• {item}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Week 2 Data ──────────────────────────────────────────────────────────────

const UNC_PLAYERS: PlayerEntry[] = [
  {
    name: "Kyojinnn",
    role: "TOP",
    tier: "EMERALD",
    rank: "II",
    lp: 95,
    games: 54,
    wr: 46.3,
    kda: 2.44,
    avgDmg: 26009,
    avgCs: 222.2,
    playstyle:
      "Jungle main playing top lane for the tournament — 54 ranked top games vs 200+ jungle games. His Jayce, which he dominates on in jungle, has a terrible 25% WR in the top lane. MonkeyKing (71.4% WR) and Pantheon (55.6%) are more reliable top options. Raw Emerald II mechanics translate even off-role, but his champion pool is thin and untested in a 1v1 laning environment.",
    threats: [
      "Emerald II — highest elo on UNC; raw mechanics are dangerous even off-role",
      "MonkeyKing (7g, 71.4% WR) — most reliable top pick; strong skirmish and split-push threat",
      "Pantheon (9g, 55.6%) — poke + all-in pressure, ult can roam mid to assist DarrowTheReaper",
    ],
    weaknesses: [
      "Jungle main off-role — only 54 ranked top games; limited matchup experience in lane",
      "Jayce top (12g, 25% WR) — his most-played top pick is failing at a significant rate",
      "Camille (4g, 25%) and Ornn (3g, 0%) show poor results on meta picks",
      "46.3% WR overall at top — losing record in his tournament role",
    ],
    champs: [
      { name: "Jayce", games: 12, wr: 25.0, kda: 2.49, avgDmg: 25963, avgCs: 244.5, note: "Frequent pick — terrible WR in top lane" },
      { name: "Pantheon", games: 9, wr: 55.6, kda: 2.58, avgDmg: 29834, avgCs: 224.6, note: "Poke + roam threat" },
      { name: "MonkeyKing", games: 7, wr: 71.4, kda: 2.39, avgDmg: 26562, avgCs: 200.9, note: "Best top lane pick" },
      { name: "Lissandra", games: 5, wr: 40.0, kda: 2.32, avgDmg: 29132, avgCs: 269.6 },
      { name: "Camille", games: 4, wr: 25.0, kda: 2.3, avgDmg: 17656, avgCs: 172.0 },
      { name: "Ornn", games: 3, wr: 0.0, kda: 2.36, avgDmg: 28631, avgCs: 221.7, note: "0% WR — do not expect this" },
      { name: "Chogath", games: 2, wr: 100.0, kda: 3.0, avgDmg: 31325, avgCs: 217.5 },
      { name: "Quinn", games: 2, wr: 100.0, kda: 2.47, avgDmg: 32329, avgCs: 218.5 },
    ],
  },
  {
    name: "RedSyven",
    role: "JGL",
    tier: "GOLD",
    rank: "IV",
    lp: 30,
    games: 206,
    wr: 48.1,
    kda: 3.3,
    avgDmg: 21515,
    avgCs: 196.4,
    playstyle:
      "XinZhao one-trick who has spent 108 games on his primary pick — and sits below 50% WR on it. Kindred is his actual best pick at 57.1% WR and should be respected. Shyvana at 50% WR is a secondary option. Sylas (33.3% WR across 24 games) is a recurring misplay that never works. Gold IV is the lowest elo on UNC and faces Oxymoronical — the biggest jungle elo gap CT will see this season.",
    threats: [
      "Kindred (28g, 57.1% WR) — his best pick; lane invade and scaling threat, pairs well with Lux CC",
      "Diana (6g, 66.7%) — small-sample pocket; strong diver with CC synergy",
      "Pantheon (5g, 60%) — roaming gank pressure, possible cheese into top/mid",
    ],
    weaknesses: [
      "Gold IV vs Oxymoronical (Emerald III) — 2+ division elo gap in jungle",
      "XinZhao (108g, 47.2% WR) — primary pick with a losing record after 108 games",
      "Sylas (24g, 33.3%) — frequently plays it, never succeeds; likely to reach for it under pressure",
      "Overall 48.1% WR across 206 games — losing record as a jungler",
    ],
    champs: [
      { name: "XinZhao", games: 108, wr: 47.2, kda: 3.12, avgDmg: 20639, avgCs: 189.1, note: "Primary — below 50% WR" },
      { name: "Shyvana", games: 32, wr: 50.0, kda: 3.94, avgDmg: 25047, avgCs: 217.6 },
      { name: "Kindred", games: 28, wr: 57.1, kda: 4.51, avgDmg: 25727, avgCs: 209.8, note: "Best pick — ban priority" },
      { name: "Sylas", games: 24, wr: 33.3, kda: 2.51, avgDmg: 16396, avgCs: 180.0, note: "Frequent attempt, bad results" },
      { name: "Diana", games: 6, wr: 66.7, kda: 2.96, avgDmg: 15763, avgCs: 198.0 },
      { name: "Pantheon", games: 5, wr: 60.0, kda: 3.27, avgDmg: 25780, avgCs: 207.6 },
      { name: "MonkeyKing", games: 3, wr: 33.3, kda: 3.35, avgDmg: 21395, avgCs: 213.7 },
    ],
  },
  {
    name: "DarrowTheReaper",
    role: "MID",
    tier: "GOLD",
    rank: "III",
    lp: 15,
    games: 132,
    wr: 48.5,
    kda: 2.01,
    avgDmg: 32396,
    avgCs: 194.2,
    playstyle:
      "Lux is his entire identity — 45 games at 64.4% WR is dominant, and without it there is no reliable fallback. Viktor (48.1% on 27 games), LeBlanc (42.9%), and Malzahar (40%) are all below average. Locke at 55.6% (9 games) is his only viable alternative. Banning Lux in Phase 1 fundamentally breaks his champion select — he becomes a mid laner with no picks above 50% WR.",
    threats: [
      "Lux (45g, 64.4% WR) — the single most important ban in this matchup; root + ult enables FPSakulF's Ashe slow combos for long-range picks",
      "Locke (9g, 55.6%) — viable fallback; high damage output (35k avg), can punish overextension",
      "High average damage (32,396) — consistently punishes poor positioning from distance",
    ],
    weaknesses: [
      "Without Lux: entire pool falls below 50% WR — Viktor (48.1%), LeBlanc (42.9%), Malzahar (40%), Katarina (28.6%)",
      "Gold III vs Hive (Gold I) — elo disadvantage in the mid lane",
      "KDA 2.01 — lowest on UNC, dies reaching for Lux Q roots more than he lands them",
      "Katarina (7g, 28.6%) and TwistedFate (2g, 0%) are dangerous fallback attempts under pressure",
    ],
    champs: [
      { name: "Lux", games: 45, wr: 64.4, kda: 2.8, avgDmg: 34576, avgCs: 218.3, note: "PRIORITY BAN — his entire identity" },
      { name: "Viktor", games: 27, wr: 48.1, kda: 1.93, avgDmg: 36069, avgCs: 197.4, note: "High volume, below 50%" },
      { name: "Leblanc", games: 14, wr: 42.9, kda: 1.78, avgDmg: 30796, avgCs: 162.7 },
      { name: "Malzahar", games: 10, wr: 40.0, kda: 1.23, avgDmg: 26895, avgCs: 224.6 },
      { name: "Locke", games: 9, wr: 55.6, kda: 2.28, avgDmg: 35057, avgCs: 183.8, note: "Only viable fallback" },
      { name: "Katarina", games: 7, wr: 28.6, kda: 1.62, avgDmg: 28975, avgCs: 155.3, note: "Bad WR — exploitable" },
      { name: "Veigar", games: 4, wr: 25.0, kda: 1.67, avgDmg: 32801, avgCs: 195.5 },
      { name: "Briar", games: 4, wr: 50.0, kda: 1.95, avgDmg: 38324, avgCs: 130.5 },
    ],
  },
  {
    name: "FPSakulF",
    role: "BOT",
    tier: "EMERALD",
    rank: "IV",
    lp: 78,
    games: 231,
    wr: 50.2,
    kda: 2.78,
    avgDmg: 28738,
    avgCs: 221.5,
    playstyle:
      "Two-headed primary of Ashe (92g, 50% WR) and Vayne (67g, 55.2% WR) — Vayne is clearly his stronger pick, Ashe is the comfort fallback. The captain of UNC and the most dangerous player in this matchup at Emerald IV facing Silver I. His bot lane with SayLemons has a 75% WR when playing together in flex (9W 3L) — treat this bot lane as a coordinated unit, not two random solo queue players.",
    threats: [
      "Vayne (67g, 55.2% WR) — his best pick; scales into an unkillable side-lane threat late",
      "Emerald IV vs Nekter (Silver I) — largest elo gap in this matchup, 3 divisions",
      "FPSakulF + SayLemons in team play: 75% WR (9W 3L) — coordinated bot lane, not solo queue individuals",
      "Caitlyn (23g) pairs naturally with Lux mid for a long-range poke-lock composition",
    ],
    weaknesses: [
      "Ashe (92g, 50% WR) — high-volume comfort pick but only 50%; below expectation for Emerald IV",
      "Kaisa (29g, 48.3%), Caitlyn (47.8%), Yunara (42.9%) — all remaining picks are below 50% WR",
      "Lower average damage (28,738) than typical for an Emerald IV ADC — passive, positioning-focused playstyle",
      "If both Vayne and Ashe are banned, his entire remaining pool is below 50% WR",
    ],
    champs: [
      { name: "Ashe", games: 92, wr: 50.0, kda: 2.94, avgDmg: 25775, avgCs: 212.6, note: "Volume primary — only 50% WR" },
      { name: "Vayne", games: 67, wr: 55.2, kda: 2.9, avgDmg: 29184, avgCs: 220.9, note: "Best pick — priority ban" },
      { name: "Kaisa", games: 29, wr: 48.3, kda: 2.98, avgDmg: 32174, avgCs: 225.7 },
      { name: "Caitlyn", games: 23, wr: 47.8, kda: 2.52, avgDmg: 35986, avgCs: 257.6, note: "Pairs with Lux mid for poke lock" },
      { name: "Yunara", games: 7, wr: 42.9, kda: 2.35, avgDmg: 35877, avgCs: 257.1 },
      { name: "Draven", games: 3, wr: 33.3, kda: 1.59, avgDmg: 26625, avgCs: 189.0 },
      { name: "Jinx", games: 2, wr: 50.0, kda: 3.75, avgDmg: 21945, avgCs: 240.5 },
    ],
  },
  {
    name: "SayLemons",
    role: "SUP",
    tier: "GOLD",
    rank: "III",
    lp: 18,
    games: 18,
    wr: 50,
    kda: 3.97,
    avgDmg: 10500,
    avgCs: 28,
    playstyle:
      "18 solo-ranked support games at 50% WR (9W 9L) — verified via Mobalytics. KDA 3.97, KP 63%, vision score 73.2/game (Vision Focused badge). Primary pick is Braum (7g, 57% WR) — Ashe passive + Braum passive creates a permastun chain. Also plays Rell, Seraphine, and is experimenting with Mel (new champion). Appears to be primarily a jungler playing support for the team. Mobalytics shows 75% WR (9W 3L) when playing with FPSakulF and 77.8% with DarrowTheReaper — in coordinated team play, he's a different player. Also Platinum IV 69LP in flex (125 games, 51.2% WR) — more experienced than his Gold III solo rank suggests.",
    threats: [
      "Braum (7g, 57.1% WR) — primary pick; Ashe slow → Braum passive chain creates free CC perma-lock",
      "Seraphine (2g, 50%) and Lulu (1g, 100%) — enchanters that double FPSakulF's late-game scaling",
      "Rell (2g, 50%) — engage tank with reliable all-in; works with Ashe root setup",
      "Team coordination: 75% WR with FPSakulF in flex — bot lane plays as a unit, not two randoms",
    ],
    weaknesses: [
      "Only 18 solo queue ranked support games — thin sample; small champion pool depth",
      "Possibly off-role (jungle main playing support) — 86 jungle games at 64% WR is his real role",
      "All 5 known supports have ≤7 games — any novel matchup puts him in unexplored territory",
      "Seraphine (2g) and Lulu (1g) are tiny samples; champion depth is unproven beyond Braum",
    ],
    champs: [
      { name: "Braum", games: 7, wr: 57.1, kda: 4.9, avgDmg: 10224, avgCs: 27.5, note: "Primary pick — Ashe passive synergy" },
      { name: "Rell", games: 2, wr: 50.0, kda: 4.69, avgDmg: 7948, avgCs: 35.0 },
      { name: "Seraphine", games: 2, wr: 50.0, kda: 7.33, avgDmg: 11175, avgCs: 26.5 },
      { name: "Lulu", games: 1, wr: 100.0, kda: 6.0, avgDmg: 7844, avgCs: 22.0, note: "1g sample only" },
      { name: "Mel", games: 1, wr: 100.0, kda: 5.0, avgDmg: 8000, avgCs: 20.0, note: "New champion, experimenting" },
    ],
  },
];

const UNC_OPGG = "https://op.gg/lol/multisearch/na?summoners=Kyojinnn%23NA1%2CRedSyven%23NA1%2CDarrowTheReaper%23red%2CFPSakulF%23NA1%2CSayLemons%23NA1";

// ─── Week 2 Write-Up Component ─────────────────────────────────────────────────

function Week2() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Week 2 — Lugia Division</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#f1f5f9", margin: 0, letterSpacing: "-0.5px" }}>
          Collision Time <span style={{ color: "#3b82f6" }}>vs.</span> Ahrin's Uncles
        </h1>
        <p style={{ color: "#64748b", marginTop: 8, marginBottom: 14, fontSize: 15 }}>Scouting report, ban priorities, and draft simulations</p>
        <div style={{ display: "flex", gap: 10 }}>
          <OpggLink href={CT_OPGG} label="Collision Time" />
          <OpggLink href={UNC_OPGG} label="Ahrin's Uncles" />
        </div>
      </div>

      {/* TL;DR */}
      <div style={{ ...S.section, background: "#162032", borderColor: "#1e3a5f" }}>
        <div style={S.sectionTitle}>TL;DR — Key Takeaways</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>UNC Threat Tier</div>
            {[
              { name: "FPSakulF (BOT)", tier: "S", reason: "Emer IV, 231 games, Vayne/Ashe — largest elo gap this season" },
              { name: "Kyojinnn (TOP)", tier: "A", reason: "Emer II raw skill, but jungle main with 46% WR at top" },
              { name: "DarrowTheReaper (MID)", tier: "B", reason: "Gold III, but Lux at 64.4% WR is a game-defining pick if unbanned" },
              { name: "SayLemons (SUP)", tier: "C", reason: "Gold III, 50% solo ranked support WR but 75% WR with FPSakulF in team play" },
              { name: "RedSyven (JGL)", tier: "D", reason: "Gold IV, 48% WR on primary — Oxy dominates this matchup" },
            ].map((t) => (
              <div key={t.name} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: t.tier === "S" ? "#f87171" : t.tier === "A" ? "#fb923c" : t.tier === "B" ? "#fbbf24" : t.tier === "C" ? "#94a3b8" : "#64748b", width: 18, flexShrink: 0 }}>{t.tier}</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>{t.name}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}> — {t.reason}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>CT Advantages to Play To</div>
            {[
              "Ban Lux: DarrowTheReaper has zero picks above 50% WR without his signature",
              "Oxymoronical (Emerald III) vs RedSyven (Gold IV) — biggest jungle elo gap CT has faced",
              "Kyojinnn is a jungle main at top — 46.3% WR in his tournament role",
              "Hive (Gold I) outranks Darrow (Gold III) and can freely counterpick his weak fallbacks",
              "Ransom's Malphite (70% WR) teamfight anchor is still available if unbanned",
              "Nekter's Twitch (78.6%) hidden pocket stays uncountered unless scouted",
            ].map((a, i) => (
              <div key={i} style={S.bullet}>• {a}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>CT Risk Factors</div>
            {[
              "FPSakulF (Emerald IV) vs Nekter (Silver I) — 3-division elo gap at bot, CT's biggest exposure",
              "FPSakulF + SayLemons have 75% WR playing together — this bot lane coordinates well",
              "Kyojinnn's Emerald II mechanics still show up even off-role; don't give him carry picks",
              "Vayne late game with Seraphine/Lulu scaling is a teamfight landmine if the game runs long",
              "SayLemons is currently on a 7W 3L hot streak at support",
            ].map((a, i) => (
              <div key={i} style={S.bullet}>• {a}</div>
            ))}
          </div>
        </div>
      </div>

      {/* UNC Scouting */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Ahrin's Uncles — Player Profiles</div>
        {UNC_PLAYERS.map((p) => (
          <PlayerCard key={p.name} p={p} highlight={p.name === "FPSakulF" || p.name === "DarrowTheReaper"} />
        ))}
      </div>

      {/* CT Profiles */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Collision Time — Player Profiles</div>
        {CT_PLAYERS.map((p) => (
          <PlayerCard key={p.name} p={p} />
        ))}
      </div>

      {/* Ban Priorities */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Ban Priority Guide</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={S.h3}>CT's Bans vs UNC</div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#7f1d1d", color: "#fca5a5", border: "1px solid #ef444444" }}>1. Lux</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>DarrowTheReaper's 45g 64.4% WR identity pick — removes it and his entire pool is below 50% WR. Always ban this first.</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#7f1d1d", color: "#fca5a5", border: "1px solid #ef444444" }}>2. Vayne</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>FPSakulF's best pick at 67g 55.2% WR. Forces him to Ashe (50%) or worse.</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#7f1d1d", color: "#fca5a5", border: "1px solid #ef444444" }}>3. Kindred</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>RedSyven's best jungle pick (28g, 57.1% WR) — denying it forces him onto his losing-record XinZhao primary.</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#78350f", color: "#fde68a", border: "1px solid #f59e0b44" }}>4. Ashe</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>FPSakulF's volume pick — if both Vayne AND Ashe are banned, all his remaining ADCs are below 50% WR.</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#78350f", color: "#fde68a", border: "1px solid #f59e0b44" }}>5. Braum</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>SayLemons' primary support (7g, 57% WR) — banning it eliminates the Ashe passive + Braum passive permastun chain and forces him onto his ≤2 game picks.</span>
            </div>
          </div>

          <div>
            <div style={S.h3}>UNC's Likely Bans vs CT</div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#1a1a2e", color: "#94a3b8", border: "1px solid #33415566" }}>Expected: Nocturne</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Oxymoronical's 80% WR will be scouted — they must remove it</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#1a1a2e", color: "#94a3b8", border: "1px solid #33415566" }}>Expected: Viktor</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Hive's 56% WR signature on 80 games</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#1a1a2e", color: "#94a3b8", border: "1px solid #33415566" }}>Expected: Malphite</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Ransom's 70% WR teamfight anchor hard-counters UNC's poke composition</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#1a1a2e", color: "#94a3b8", border: "1px solid #33415566" }}>Possible: Twitch</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>If they scout Nekter's 78.6% WR pocket pick</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ ...S.tag, background: "#1a1a2e", color: "#94a3b8", border: "1px solid #33415566" }}>Possible: Shyvana</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Oxy's 68.8% WR pick that also denies RedSyven's secondary option</span>
            </div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#0f172a", borderRadius: 8, border: "1px solid #334155" }}>
              <span style={{ fontSize: 13, color: "#fbbf24" }}>💡 Strategic Note:</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}> If UNC bans Nocturne + Viktor + Malphite, CT pivots to: Shyvana (Oxy 68.8%) + Syndra or Veigar (Hive 57-59%) + Olaf/Sion (Ransom 75%). UNC has likely not prepared for these and the power level stays high.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Playstyle Analysis */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Playstyle & Matchup Analysis</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
          <div>
            <div style={S.h3}>UNC Tendencies</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Long-range poke composition:</b> Lux mid + Ashe bot creates a root-and-slow lockdown from range — Ashe W slows targets that Lux Q then roots, setting up a free ult. This is their primary identity if Lux isn't banned.</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Enchanter bot lane scaling:</b> SayLemons on Seraphine/Lulu buffs FPSakulF's Vayne/Ashe into an unkillable lategame carry. They play together at 75% WR — this bot lane is coordinated.</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Off-role top and support:</b> Both Kyojinnn and SayLemons appear to be jungle mains playing out of position. Their lane performance should trail their raw elo.</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Their win condition:</b> Get Lux ahead → Ashe + Lux poke combo disables CT → FPSakulF scales on Vayne/Ashe + Seraphine to carry teamfights</div>
          </div>
          <div>
            <div style={S.h3}>CT's Win Condition</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Ban Lux, always:</b> Without Lux, DarrowTheReaper's pool is entirely below 50% WR. His fallback (Locke, Viktor, LeBlanc) is manageable for Hive. This one ban neutralizes UNC's entire mid lane strategy.</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Let Oxy run the map:</b> RedSyven is Gold IV with a losing-record primary. Oxymoronical can invade, steal camps, and snowball bot to negate FPSakulF's elo advantage early.</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Pressure bot early:</b> Camp FPSakulF before he scales — if Nekter can get even or ahead, the Twitch pocket becomes a late-game monster UNC hasn't prepared for.</div>
            <div style={S.bullet}>• <b style={{ color: "#cbd5e1" }}>Don't give Kyojinnn MonkeyKing:</b> His 71.4% WR top pick thrives in skirmishes. Force him onto Jayce (25% WR) or Lissandra (40%) where he's ineffective.</div>
          </div>
        </div>

        <div style={{ padding: "14px 18px", background: "#0f172a", borderRadius: 8, border: "1px solid #334155" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Strongest vs. Weakest — UNC Assessment</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#f87171", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Strongest: FPSakulF (BOT)</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>Emerald IV with 231 bot games. His Vayne (55.2%) and Ashe (50%) provide consistent scaling. The 3-division gap vs Nekter (Silver I) is the biggest raw elo advantage UNC has in any lane. His coordination with SayLemons at 75% WR makes this bot lane a genuine unit, not just two players.</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#4ade80", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Weakest: RedSyven (JGL)</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>Gold IV with a 48.1% WR across 206 games — a losing record despite massive play volume. XinZhao, his primary at 108 games, sits at 47.2% WR. Sylas is a 33.3% WR trap he keeps reaching for. Facing Oxymoronical (Emerald III, 80% Nocturne WR), this is CT's easiest lane to exploit.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Draft Simulations */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Draft Simulations</div>
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
          Three scenarios covering different side assignments and priority adjustments. The Lux ban is non-negotiable in all scenarios — everything else adapts around it.
        </p>

        <DraftSim
          title="Scenario A — CT Blue Side (Standard)"
          ctSide="Blue"
          opponentName="Ahrin's Uncles"
          scenario="Blue side lets CT grab Shyvana at B1, removing it from RedSyven while giving Oxy his 68.8% WR pick. Bans target Lux (Darrow's identity), Vayne (FPSakulF's best), and Kindred (RedSyven's only reliable pick)."
          p1Bans={[
            "Lux",        // CT Blue1: DarrowTheReaper's 64.4% identity — must ban, always
            "Nocturne",   // UNC Red1: Oxy's 80% WR, expected
            "Vayne",      // CT Blue2: FPSakulF's best pick at 55.2% WR
            "Viktor",     // UNC Red2: Hive's signature
            "Kindred",    // CT Blue3: RedSyven's 57.1% WR best pick
            "Malphite",   // UNC Red3: Ransom's 70% WR
          ]}
          p1Picks={[
            { champ: "Shyvana", role: "JGL" },     // CT B1: Oxy 68.8% WR, denies RedSyven's secondary option
            { champ: "MonkeyKing", role: "TOP" },  // UNC R1: Kyojinnn's 71.4% WR top pick
            { champ: "Ashe", role: "BOT" },        // UNC R2: FPSakulF — Vayne banned, falls to volume pick
            { champ: "Syndra", role: "MID" },      // CT B2: Hive 57.4% — dominates Darrow's weak fallbacks
            { champ: "Olaf", role: "TOP" },        // CT B3: Ransom 75% — Olaf ult counters MonkeyKing suppression
            { champ: "XinZhao", role: "JGL" },     // UNC R3: RedSyven — forced to losing-record primary
          ]}
          p2Bans={[
            "Twitch",     // UNC Red1: deny Nekter's pocket if scouted
            "Braum",      // CT Blue1: SayLemons' primary pick (7g, 57%); eliminates Ashe+Braum passive chain
            "Nasus",      // UNC Red2: deny Oxy's 73.7% scaling jungle (Nocturne already banned)
            "Diana",      // CT Blue2: deny RedSyven's 66.7% WR pocket remaining option
          ]}
          p2Picks={[
            { champ: "Locke", role: "MID" },       // UNC R4: Darrow's only viable fallback at 55.6% WR
            { champ: "Kaisa", role: "BOT" },       // CT B4: Nekter — Twitch banned, Kaisa 51.6% WR
            { champ: "Sona", role: "SUP" },        // CT B5: Hond 66.7% WR — ult chains with Syndra for wombo
            { champ: "Seraphine", role: "SUP" },   // UNC R5: SayLemons — Braum banned, falls to Seraphine (2g, 50%)
          ]}
          notes={[
            "Shyvana B1 does double duty: gives Oxy his 68.8% WR pick AND removes RedSyven's best secondary option in one move.",
            "Lux ban (CT Blue1) is the keystone of the draft — without it, DarrowTheReaper's pool collapses entirely below 50% WR.",
            "With Vayne + Kindred banned, FPSakulF falls to Ashe (50%) and RedSyven falls to XinZhao (47.2%) — both below their peak performance.",
            "Olaf (Ransom 75% WR) specifically counters MonkeyKing: Ragnarok CC-immunity negates Wuju Style suppression, letting Ransom fight through MonkeyKing's passive.",
            "Syndra (Hive 57.4%) dominates Darrow's fallback pool — Syndra E roots and ult combo punishes Locke's immobility.",
            "Sona ult (Crescendo) + Syndra ult combo is the teamfight closer — stun the whole team, then delete the carry.",
            "Braum ban removes SayLemons' primary pick (7g, 57%) and eliminates the Ashe passive + Braum passive permastun chain. He falls to Seraphine (2g, 50%) — a step down from his comfort pick.",
            "Win condition: Shyvana secures 2 dragon stacks before 20 minutes, Syndra bullies Locke off waves, Kaisa/Sona close teamfights.",
          ]}
        />

        <DraftSim
          title="Scenario B — CT Red Side"
          ctSide="Red"
          opponentName="Ahrin's Uncles"
          scenario="Red side counter-pick advantage. CT must pre-ban Lux to prevent Darrow from taking it at B1 — they'd grab it immediately given first pick. CT then uses R1-R2 to lock Shyvana and Syndra after seeing UNC's opening move."
          p1Bans={[
            "Nocturne",   // UNC Blue1: Oxy's 80% WR — expected first ban
            "Lux",        // CT Red1: must ban even on red side — UNC takes it B1 if available
            "Malphite",   // UNC Blue2: Ransom's 70% WR
            "Vayne",      // CT Red2: FPSakulF's best pick
            "Viktor",     // UNC Blue3: Hive's signature
            "Kindred",    // CT Red3: RedSyven's 57.1% best pick
          ]}
          p1Picks={[
            { champ: "MonkeyKing", role: "TOP" },  // UNC B1: Kyojinnn grabs 71.4% WR pick (Lux/Viktor/Nocturne banned)
            { champ: "Shyvana", role: "JGL" },     // CT R1: Oxy 68.8% — counter-pick advantage, grab immediately
            { champ: "Syndra", role: "MID" },      // CT R2: Hive 57.4% — sees Darrow has no Lux, locks carry mid
            { champ: "XinZhao", role: "JGL" },     // UNC B2: RedSyven — Kindred banned, forced to primary
            { champ: "Ashe", role: "BOT" },        // UNC B3: FPSakulF — Vayne banned, falls to volume pick
            { champ: "Olaf", role: "TOP" },        // CT R3: Ransom 75% WR — counter into MonkeyKing
          ]}
          p2Bans={[
            "Braum",      // CT Red1: remove SayLemons' primary pick (7g, 57%); kills Ashe+Braum chain
            "Twitch",     // UNC Blue1: deny Nekter's pocket
            "Seraphine",  // CT Red2: remove SayLemons' enchanter option (2g, 50%)
            "Kaisa",      // UNC Blue2: deny Nekter's most-played ADC fallback
          ]}
          p2Picks={[
            { champ: "Tristana", role: "BOT" },    // CT R4: Nekter — Twitch/Kaisa banned, Tristana 50% WR
            { champ: "Locke", role: "MID" },       // UNC B4: Darrow — 55.6% WR, only viable fallback after Lux ban
            { champ: "Lulu", role: "SUP" },        // UNC B5: SayLemons — Braum+Seraphine banned, Lulu (1g, 100%)
            { champ: "Sona", role: "SUP" },        // CT R5: Hond 66.7% — ult into Syndra wombo, shields Tristana
          ]}
          notes={[
            "Lux must be banned on red side even though it costs CT a ban slot — giving DarrowTheReaper his 64.4% WR identity at B1 is unacceptable.",
            "Red side counter-pick advantage: CT sees MonkeyKing at B1 and locks Shyvana + Syndra at R1-R2. Perfect position — Syndra knows Darrow has no Lux.",
            "Olaf at R3 is the counter-pick payoff: after seeing MonkeyKing (B1), CT picks Olaf — Ragnarok CC-immunity negates MonkeyKing's suppression passive, letting Ransom fight freely through his kit.",
            "Braum + Seraphine bans (CT Phase 2) strip SayLemons' two primary options. He falls to Lulu (1 game, 100% WR) — tiny sample, unknown performance in competitive play.",
            "UNC banning Kaisa forces Nekter to Tristana (50% WR) — a step down from Twitch or Kaisa, but Tristana scales into the Syndra + Sona CC comp.",
            "Sona ult + Syndra E → Ult is a reliable wombo combo that UNC's comp (MonkeyKing, Locke, Lulu) has no clean answer to.",
            "Win condition: Syndra snowballs Locke in mid, Shyvana dragon control, Tristana/Sona outscale Ashe/Lulu in lategame.",
          ]}
        />

        <DraftSim
          title="Scenario C — Blue Side, Lux Unbanned (Veigar Counter-Pick)"
          ctSide="Blue"
          opponentName="Ahrin's Uncles"
          scenario="CT deliberately leaves Lux open. UNC takes it at R1 for Darrow. CT answers with Veigar — Veigar E cage traps the immobile Lux and one-shots her at 2 items. Uses the saved Lux ban on Sylas to prevent RedSyven from attempting his 33% WR pick and freeing up a ban slot for additional pressure."
          p1Bans={[
            "Vayne",      // CT Blue1: FPSakulF's best pick — still priority even without Lux ban
            "Nocturne",   // UNC Red1: Oxy's 80% WR, expected
            "Kindred",    // CT Blue2: RedSyven's 57.1% best pick
            "Viktor",     // UNC Red2: Hive's signature
            "Sylas",      // CT Blue3: deny RedSyven's recurring misplay (33% WR) + any jungle flex attempt
            "Malphite",   // UNC Red3: Ransom's 70% WR
          ]}
          p1Picks={[
            { champ: "Shyvana", role: "JGL" },     // CT B1: Oxy 68.8% — before UNC can deny it
            { champ: "Lux", role: "MID" },         // UNC R1: DarrowTheReaper takes his identity (not banned)
            { champ: "MonkeyKing", role: "TOP" },  // UNC R2: Kyojinnn's 71.4% best pick
            { champ: "Veigar", role: "MID" },      // CT B2: Hive 59.4% — counter to Lux; E cage traps immobile Lux
            { champ: "Olaf", role: "TOP" },        // CT B3: Ransom 75% — counter MonkeyKing suppression
            { champ: "XinZhao", role: "JGL" },     // UNC R3: RedSyven — Kindred/Sylas banned, forced to primary
          ]}
          p2Bans={[
            "Twitch",     // UNC Red1: deny Nekter's pocket
            "Braum",      // CT Blue1: SayLemons' primary pick (7g, 57%); eliminates Ashe+Braum chain
            "Nasus",      // UNC Red2: deny Oxy's 73.7% scaling jungle
            "Seraphine",  // CT Blue2: SayLemons' enchanter option (2g, 50%)
          ]}
          p2Picks={[
            { champ: "Ashe", role: "BOT" },        // UNC R4: FPSakulF — Vayne banned, falls to Ashe
            { champ: "Kaisa", role: "BOT" },       // CT B4: Nekter — Twitch banned, Kaisa 51.6% WR
            { champ: "Sona", role: "SUP" },        // CT B5: Hond 66.7% — ult into Veigar cage for wombo
            { champ: "Rell", role: "SUP" },        // UNC R5: SayLemons — Braum+Seraphine banned, Rell (2g, 50%)
          ]}
          notes={[
            "Deliberately leaving Lux open is a calculated trade: CT uses that ban on Sylas (stops RedSyven's 33% WR trap pick) and gains the Veigar counter-pick instead.",
            "Veigar E cage is the answer to Lux: Lux is immobile and squishy. Veigar E → AA → Q → R deletes her at 2 items. She can't dodge Veigar E at close range.",
            "Shyvana B1 before UNC can take it — RedSyven's Shyvana is only 50% WR vs Oxy's 68.8%, so CT wins this trade even as a race.",
            "Olaf (Ransom 75% WR) counter-picks MonkeyKing at B3: Ragnarok lets Olaf fight through MonkeyKing's suppression passive, turning his best tool off.",
            "Braum + Seraphine bans strip SayLemons' two primary supports. He falls to Rell (2g, 50%) — shifts UNC from scaling to engage, but Rell's limited games means uncertain execution.",
            "Sona ult (Crescendo) + Veigar E cage + Veigar R is a reliable pick-off combo that executes Lux or Ashe at any range.",
            "Key risk: if Darrow lands Lux ult through Veigar positioning, he can still burst. Hive needs to cage her before she can poke freely.",
            "Win condition: Veigar snowballs Lux in mid lane, Shyvana takes dragon control, Kaisa/Sona outscale Ashe/Rell in 5v5 teamfights.",
          ]}
        />
      </div>

      {/* Summary */}
      <div style={{ ...S.section, background: "#111827", borderColor: "#1e3a5f" }}>
        <div style={S.sectionTitle}>Final Recommendations</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          {[
            {
              label: "Must-Ban",
              color: "#ef4444",
              items: [
                "Lux — DarrowTheReaper's 45g 64.4% WR identity; removes it and his pool is entirely below 50%",
                "Vayne — FPSakulF's 55.2% WR best pick; force him to 50% Ashe",
              ],
            },
            {
              label: "Strong-Ban",
              color: "#f59e0b",
              items: [
                "Kindred (RedSyven's 57.1% WR best — forces him to XinZhao losing record)",
                "Braum (SayLemons' primary at 7g, 57%; banning it + Seraphine leaves him on ≤2 game picks)",
                "Ashe (ban both Vayne + Ashe to break FPSakulF entirely)",
              ],
            },
            {
              label: "CT Priority Picks",
              color: "#22c55e",
              items: [
                "Shyvana (Oxy 68.8%) — grab B1 every blue-side game",
                "Nocturne (Oxy 80%) — if unbanned, pick immediately",
                "Olaf (Ransom 75%) — hard counters MonkeyKing suppression via Ragnarok",
                "Twitch (Nekter 78.6%) — hide until Phase 2, it's likely not banned",
                "Syndra (Hive 57.4%) — dominant into Darrow's weak fallback pool",
              ],
            },
          ].map((col) => (
            <div key={col.label}>
              <div style={{ fontSize: 12, fontWeight: 700, color: col.color, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>{col.label}</div>
              {col.items.map((item, i) => (
                <div key={i} style={S.bullet}>• {item}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Route Entry ──────────────────────────────────────────────────────────────

export default function WriteUp() {
  const { week } = useParams<{ week: string }>();

  if (week === "1") return <Week1 />;
  if (week === "2") return <Week2 />;

  return (
    <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Write-up not found</div>
      <div style={{ fontSize: 14, color: "#64748b" }}>No write-up available for week {week}.</div>
    </div>
  );
}
