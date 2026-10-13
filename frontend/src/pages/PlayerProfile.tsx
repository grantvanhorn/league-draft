import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPlayer, refreshPlayer, getDDVersion, getChampions, submitLpHistory, getTournamentTeams } from "../lib/api";
import { PlayerProfile, MatchRecord, RankedEntry, RankedSnapshot, ChampionData, TournamentTeam } from "../types";
import { profileIconUrl, champIconUrl, tierColor } from "../lib/ddragon";
import RankBadge from "../components/RankBadge";
import { queueLabel } from "../lib/queues";
import { useQueueFilter } from "../lib/useQueueFilter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(sec?: number) {
  if (!sec) return "?";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function fmtK(n?: number) {
  if (n == null) return "?";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function queueShort(id?: number) {
  return queueLabel(id);
}

interface ChampStat {
  name: string; games: number; wins: number; winrate: number;
  kda: number; avgK: number; avgD: number; avgA: number;
  avgCsMin: number | null; avgDmg: number | null;
}

function computeChampStats(matches: MatchRecord[]): ChampStat[] {
  const map: Record<string, {
    w: number; l: number; k: number; d: number; a: number;
    csMin: number; csMinN: number; dmg: number; dmgN: number;
  }> = {};
  for (const m of matches) {
    if (!map[m.championName]) map[m.championName] = { w: 0, l: 0, k: 0, d: 0, a: 0, csMin: 0, csMinN: 0, dmg: 0, dmgN: 0 };
    const s = map[m.championName];
    s[m.win ? "w" : "l"]++;
    s.k += m.kda.kills; s.d += m.kda.deaths; s.a += m.kda.assists;
    if (m.csPerMin != null) { s.csMin += m.csPerMin; s.csMinN++; }
    if (m.damage != null) { s.dmg += m.damage; s.dmgN++; }
  }
  return Object.entries(map).map(([name, s]) => {
    const games = s.w + s.l;
    return {
      name, games, wins: s.w,
      winrate: Math.round((s.w / games) * 100),
      kda: s.d === 0 ? 99 : (s.k + s.a) / s.d,
      avgK: s.k / games, avgD: s.d / games, avgA: s.a / games,
      avgCsMin: s.csMinN > 0 ? s.csMin / s.csMinN : null,
      avgDmg: s.dmgN > 0 ? s.dmg / s.dmgN : null,
    };
  }).sort((a, b) => b.games - a.games || b.winrate - a.winrate);
}

// ─── Rank chart ───────────────────────────────────────────────────────────────

const TIER_BASE: Record<string, number> = {
  IRON: 0, BRONZE: 400, SILVER: 800, GOLD: 1200,
  PLATINUM: 1600, EMERALD: 2000, DIAMOND: 2400,
  MASTER: 2800, GRANDMASTER: 2900, CHALLENGER: 3000,
};
const RANK_OFFSET: Record<string, number> = { IV: 0, III: 100, II: 200, I: 300 };

function rankToLP(entry: RankedEntry): number {
  return (TIER_BASE[entry.tier] ?? 0) + (RANK_OFFSET[entry.rank] ?? 0) + Math.min(entry.leaguePoints, 99);
}

// Inverse of rankToLP — derive tier/division/lp from absolute value
function rankAtValue(v: number): { tier: string; division: string; lp: number } {
  let tier = "IRON", tierBase = 0;
  for (const [t, base] of Object.entries(TIER_BASE)) {
    if (v >= base && base >= tierBase) { tier = t; tierBase = base; }
  }
  const offset = v - tierBase;
  const DIVS = ["IV", "III", "II", "I"] as const;
  const divIdx = Math.min(Math.floor(offset / 100), 3);
  const division = offset >= 400 ? "" : DIVS[divIdx]; // Master+ has no division
  const lp = offset >= 400 ? offset : offset % 100;
  return { tier, division, lp };
}

const TIER_BOUNDARIES = [
  { label: "Iron",       value: 0,    tier: "IRON" },
  { label: "Bronze",     value: 400,  tier: "BRONZE" },
  { label: "Silver",     value: 800,  tier: "SILVER" },
  { label: "Gold",       value: 1200, tier: "GOLD" },
  { label: "Platinum",   value: 1600, tier: "PLATINUM" },
  { label: "Emerald",    value: 2000, tier: "EMERALD" },
  { label: "Diamond",    value: 2400, tier: "DIAMOND" },
  { label: "Master",     value: 2800, tier: "MASTER" },
  { label: "GM",         value: 2900, tier: "GRANDMASTER" },
  { label: "Challenger", value: 3000, tier: "CHALLENGER" },
];

function RankChart({ history, queue, label }: {
  history: RankedSnapshot[];
  queue: "soloQueue" | "flexQueue";
  label: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const points = history
    .filter((s) => s[queue] !== null)
    .map((s) => ({
      ts: new Date(s.timestamp).getTime(),
      entry: s[queue]!,
      value: rankToLP(s[queue]!),
    }))
    .sort((a, b) => a.ts - b.ts);

  if (points.length === 0) return null;

  const W = 560, H = 140;
  const padL = 72, padR = 16, padT = 12, padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const singlePoint = points.length === 1;
  const minV = Math.max(0, Math.min(...points.map((p) => p.value)) - (singlePoint ? 300 : 50));
  const maxV = Math.min(3100, Math.max(...points.map((p) => p.value)) + (singlePoint ? 300 : 50));
  const minT = points[0].ts;
  const maxT = singlePoint ? points[0].ts + 1 : points[points.length - 1].ts;
  const tRange = maxT - minT || 1;

  const xScale = (t: number) => padL + ((t - minT) / tRange) * plotW;
  const yScale = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * plotH;

  // Visible tier boundaries
  const visibleBoundaries = TIER_BOUNDARIES.filter(
    (b) => b.value >= minV && b.value <= maxV
  );

  // Build path string
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.ts).toFixed(1)} ${yScale(p.value).toFixed(1)}`).join(" ");

  // Area fill path (back along bottom)
  const areaD = pathD
    + ` L ${xScale(points[points.length - 1].ts).toFixed(1)} ${(padT + plotH).toFixed(1)}`
    + ` L ${xScale(points[0].ts).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  return (
    <div style={{ background: "#0f172a", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e293b" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
        {singlePoint && <div style={{ fontSize: 10, color: "#cbd5e1" }}>refresh to build history</div>}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {/* Tier background bands */}
        {visibleBoundaries.map((b, i) => {
          const nextB = visibleBoundaries[i + 1];
          const y1 = yScale(Math.min(nextB ? nextB.value : maxV, maxV));
          const y2 = yScale(Math.max(b.value, minV));
          if (y2 <= y1) return null;
          return (
            <rect key={b.tier} x={padL} y={y1} width={plotW} height={y2 - y1}
              fill={tierColor(b.tier)} opacity={0.06} />
          );
        })}

        {/* Tier boundary lines + labels */}
        {visibleBoundaries.map((b) => {
          const y = yScale(b.value);
          if (y < padT || y > padT + plotH) return null;
          return (
            <g key={b.tier}>
              <line x1={padL} y1={y} x2={W - padR} y2={y}
                stroke={tierColor(b.tier)} strokeWidth={0.5} strokeDasharray="3,4" opacity={0.35} />
              <text x={padL - 4} y={y + 3.5} fontSize={9} fill={tierColor(b.tier)}
                textAnchor="end" opacity={0.8}>{b.label}</text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill={tierColor(points[points.length - 1].entry.tier)} opacity={0.08} />

        {/* Line — colored per segment by starting tier */}
        {points.slice(0, -1).map((p, i) => (
          <line key={i}
            x1={xScale(p.ts)} y1={yScale(p.value)}
            x2={xScale(points[i + 1].ts)} y2={yScale(points[i + 1].value)}
            stroke={tierColor(p.entry.tier)} strokeWidth={2} strokeLinecap="round" />
        ))}

        {/* Data point dots */}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            style={{ cursor: "default" }}>
            <circle cx={xScale(p.ts)} cy={yScale(p.value)} r={10} fill="transparent" />
            <circle cx={xScale(p.ts)} cy={yScale(p.value)} r={hovered === i ? 5 : 3.5}
              fill={tierColor(p.entry.tier)} stroke="#0f172a" strokeWidth={1.5} />
          </g>
        ))}

        {/* Tooltip */}
        {hovered !== null && (() => {
          const p = points[hovered];
          const x = xScale(p.ts);
          const y = yScale(p.value);
          const tipW = 130, tipH = 40;
          const tipX = x + 10 + tipW > W ? x - tipW - 10 : x + 10;
          const tipY = y - tipH / 2;
          return (
            <g>
              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={5}
                fill="#1e293b" stroke="#cbd5e1" strokeWidth={1} />
              <text x={tipX + 8} y={tipY + 14} fontSize={11} fill={tierColor(p.entry.tier)} fontWeight={700}>
                {p.entry.tier} {p.entry.rank} {p.entry.leaguePoints}LP
              </text>
              <text x={tipX + 8} y={tipY + 28} fontSize={10} fill="#cbd5e1">
                {new Date(p.ts).toLocaleDateString()}
              </text>
            </g>
          );
        })()}

        {/* X axis dates */}
        {[points[0], points[points.length - 1]].map((p, i) => (
          <text key={i} x={xScale(p.ts)} y={H - 4} fontSize={9} fill="#cbd5e1" textAnchor={i === 0 ? "start" : "end"}>
            {new Date(p.ts).toLocaleDateString()}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── LP chart (per-game data from Mobalytics) ─────────────────────────────────

function LpChart({ matches, label }: { matches: MatchRecord[]; label: string }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const points = matches
    .filter((m) => m.lpAfter != null)
    .sort((a, b) => a.gameDate - b.gameDate)
    .map((m) => ({ ts: m.gameDate, value: m.lpAfter!, lpDiff: m.lpDiff, win: m.win, champ: m.championName }));

  if (points.length === 0) return null;

  const W = 560, H = 140;
  const padL = 72, padR = 16, padT = 12, padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const minV = Math.max(0, Math.min(...points.map((p) => p.value)) - 50);
  const maxV = Math.min(3100, Math.max(...points.map((p) => p.value)) + 50);
  const minT = points[0].ts;
  const maxT = points.length === 1 ? points[0].ts + 1 : points[points.length - 1].ts;
  const tRange = maxT - minT || 1;

  const xScale = (t: number) => padL + ((t - minT) / tRange) * plotW;
  const yScale = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * plotH;

  const visibleBoundaries = TIER_BOUNDARIES.filter((b) => b.value >= minV && b.value <= maxV);

  function tierAtValue(v: number): string {
    let tier = "IRON";
    for (const b of TIER_BOUNDARIES) { if (v >= b.value) tier = b.tier; }
    return tier;
  }

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.ts).toFixed(1)} ${yScale(p.value).toFixed(1)}`).join(" ");
  const areaD = pathD
    + ` L ${xScale(points[points.length - 1].ts).toFixed(1)} ${(padT + plotH).toFixed(1)}`
    + ` L ${xScale(points[0].ts).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  return (
    <div style={{ background: "#0f172a", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e293b" }}>
      <div style={{ fontSize: 11, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        {label} <span style={{ color: "#cbd5e1", fontWeight: 400, textTransform: "none" }}>— {points.length} games</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {visibleBoundaries.map((b, i) => {
          const nextB = visibleBoundaries[i + 1];
          const y1 = yScale(Math.min(nextB ? nextB.value : maxV, maxV));
          const y2 = yScale(Math.max(b.value, minV));
          if (y2 <= y1) return null;
          return <rect key={b.tier} x={padL} y={y1} width={plotW} height={y2 - y1} fill={tierColor(b.tier)} opacity={0.06} />;
        })}
        {visibleBoundaries.map((b) => {
          const y = yScale(b.value);
          if (y < padT || y > padT + plotH) return null;
          return (
            <g key={b.tier}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={tierColor(b.tier)} strokeWidth={0.5} strokeDasharray="3,4" opacity={0.35} />
              <text x={padL - 4} y={y + 3.5} fontSize={9} fill={tierColor(b.tier)} textAnchor="end" opacity={0.8}>{b.label}</text>
            </g>
          );
        })}
        <path d={areaD} fill={tierColor(tierAtValue(points[points.length - 1].value))} opacity={0.08} />
        {points.slice(0, -1).map((p, i) => (
          <line key={i}
            x1={xScale(p.ts)} y1={yScale(p.value)}
            x2={xScale(points[i + 1].ts)} y2={yScale(points[i + 1].value)}
            stroke={tierColor(tierAtValue(p.value))} strokeWidth={2} strokeLinecap="round" />
        ))}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: "default" }}>
            <circle cx={xScale(p.ts)} cy={yScale(p.value)} r={10} fill="transparent" />
            <circle cx={xScale(p.ts)} cy={yScale(p.value)} r={hovered === i ? 5 : 3}
              fill={p.win ? "#4ade80" : "#f87171"} stroke="#0f172a" strokeWidth={1.5} />
          </g>
        ))}
        {hovered !== null && (() => {
          const p = points[hovered];
          const x = xScale(p.ts), y = yScale(p.value);
          const { tier, division, lp } = rankAtValue(p.value);
          const tipW = 160, tipH = 52;
          const tipX = x + 10 + tipW > W ? x - tipW - 10 : x + 10;
          const tipY = y - tipH / 2;
          const diff = p.lpDiff;
          return (
            <g>
              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={5} fill="#1e293b" stroke="#cbd5e1" strokeWidth={1} />
              <text x={tipX + 8} y={tipY + 14} fontSize={11} fill={tierColor(tier)} fontWeight={700}>
                {tier}{division ? ` ${division}` : ""} {lp} LP
              </text>
              {diff != null && (
                <text x={tipX + 8} y={tipY + 28} fontSize={11} fill={diff >= 0 ? "#4ade80" : "#f87171"}>
                  {diff >= 0 ? "+" : ""}{diff} LP · {p.win ? "Win" : "Loss"}
                </text>
              )}
              <text x={tipX + 8} y={tipY + 42} fontSize={10} fill="#cbd5e1">
                {new Date(p.ts).toLocaleDateString()}
              </text>
            </g>
          );
        })()}
        {[points[0], points[points.length - 1]].map((p, i) => (
          <text key={i} x={xScale(p.ts)} y={H - 4} fontSize={9} fill="#cbd5e1" textAnchor={i === 0 ? "start" : "end"}>
            {new Date(p.ts).toLocaleDateString()}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function RankCard({ label, entry }: { label: string; entry: RankedEntry | null }) {
  if (!entry) {
    return (
      <div style={{ flex: 1, background: "#0f172a", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e293b" }}>
        <div style={{ fontSize: 11, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
        <div style={{ color: "#cbd5e1", fontSize: 14 }}>Unranked</div>
      </div>
    );
  }
  const total = entry.wins + entry.losses;
  const wr = total > 0 ? Math.round((entry.wins / total) * 100) : 0;
  return (
    <div style={{ flex: 1, background: "#0f172a", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e293b" }}>
      <div style={{ fontSize: 11, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: tierColor(entry.tier), flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: tierColor(entry.tier) }}>
            {entry.tier} {entry.rank}
          </div>
          <div style={{ fontSize: 12, color: "#cbd5e1" }}>{entry.leaguePoints} LP</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: wr >= 50 ? "#4ade80" : "#f87171" }}>{wr}%</div>
          <div style={{ fontSize: 11, color: "#8899aa" }}>{entry.wins}W {entry.losses}L</div>
        </div>
      </div>
      {entry.hotStreak && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#f59e0b" }}>Hot streak</div>
      )}
    </div>
  );
}

function GameRow({ match, champMap, ddVersion }: { match: MatchRecord; champMap: Record<string, ChampionData>; ddVersion: string }) {
  const champ = champMap[match.championName];
  const deaths = match.kda.deaths;
  const ratio = deaths === 0 ? "∞" : ((match.kda.kills + match.kda.assists) / deaths).toFixed(2);
  const ratioNum = deaths === 0 ? 99 : (match.kda.kills + match.kda.assists) / deaths;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      borderLeft: `4px solid ${match.win ? "#4ade80" : "#f87171"}`,
      background: match.win ? "rgba(74,222,128,0.04)" : "rgba(248,113,113,0.04)",
      borderRadius: "0 8px 8px 0",
    }}>
      {/* Champion icon + name */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0, width: 52 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", background: "#0f172a" }}>
          {champ && <img src={champIconUrl(ddVersion, champ.image.full)} width={44} height={44} style={{ display: "block" }} />}
        </div>
        <div style={{ fontSize: 9, color: "#cbd5e1", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: 52 }}>
          {champ?.name ?? match.championName}
        </div>
      </div>

      {/* Result + queue */}
      <div style={{ minWidth: 70, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: match.win ? "#4ade80" : "#f87171" }}>
          {match.win ? "Victory" : "Defeat"}
        </div>
        <div style={{ fontSize: 11, color: "#8899aa" }}>{queueShort(match.queueId)}</div>
        <div style={{ fontSize: 11, color: "#cbd5e1" }}>{fmtDuration(match.gameDuration)}</div>
      </div>

      {/* KDA */}
      <div style={{ minWidth: 90, flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
          {match.kda.kills} / <span style={{ color: "#f87171" }}>{match.kda.deaths}</span> / {match.kda.assists}
        </div>
        <div style={{ fontSize: 12, color: ratioNum >= 3 ? "#4ade80" : ratioNum >= 2 ? "#cbd5e1" : "#f87171" }}>
          {ratio} KDA
        </div>
      </div>

      {/* CS */}
      {match.cs != null && (
        <div style={{ minWidth: 64, flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: "#cbd5e1" }}>{match.cs} CS</div>
          {match.csPerMin != null && <div style={{ fontSize: 11, color: "#8899aa" }}>{match.csPerMin}/min</div>}
        </div>
      )}

      {/* Damage */}
      {match.damage != null && (
        <div style={{ minWidth: 60, flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: "#f59e0b" }}>{fmtK(match.damage)}</div>
          <div style={{ fontSize: 11, color: "#8899aa" }}>damage</div>
        </div>
      )}

      {/* Gold */}
      {match.gold != null && (
        <div style={{ minWidth: 54, flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: "#fbbf24" }}>{fmtK(match.gold)}</div>
          <div style={{ fontSize: 11, color: "#8899aa" }}>gold</div>
        </div>
      )}

      {/* Vision */}
      {match.visionScore != null && (
        <div style={{ minWidth: 44, flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: "#60a5fa" }}>{match.visionScore}</div>
          <div style={{ fontSize: 11, color: "#8899aa" }}>vision</div>
        </div>
      )}

      {/* LP diff + date */}
      <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
        {match.lpDiff != null && (
          <div style={{ fontSize: 13, fontWeight: 700, color: match.lpDiff >= 0 ? "#4ade80" : "#f87171" }}>
            {match.lpDiff >= 0 ? "+" : ""}{match.lpDiff} LP
          </div>
        )}
        <div style={{ fontSize: 11, color: "#8899aa" }}>{match.role || ""}</div>
        <div style={{ fontSize: 11, color: "#cbd5e1" }}>{new Date(match.gameDate).toLocaleDateString()}</div>
      </div>
    </div>
  );
}

// ─── Role filter ──────────────────────────────────────────────────────────────

type PosFilter = "ALL" | "TOP" | "JUNGLE" | "MID" | "BOT" | "SUPPORT";

function filterByPosition(champ: ChampionData, filter: PosFilter): boolean {
  if (filter === "ALL") return true;
  const t = champ.tags;
  if (filter === "TOP") return t.includes("Fighter") || (t.includes("Tank") && !t.includes("Support"));
  if (filter === "JUNGLE") return t.includes("Fighter") || (t.includes("Assassin") && !t.includes("Mage")) || t.includes("Tank");
  if (filter === "MID") return t.includes("Mage") || t.includes("Assassin");
  if (filter === "BOT") return t.includes("Marksman");
  if (filter === "SUPPORT") return t.includes("Support");
  return true;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, minWidth: 40, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

const ROLE_MATCH: Record<PosFilter, string[]> = {
  ALL: [], TOP: ["TOP"], JUNGLE: ["JUNGLE"],
  MID: ["MIDDLE", "MID"], BOT: ["BOTTOM", "BOT", "CARRY"], SUPPORT: ["UTILITY", "SUPPORT"],
};

function matchFitsRole(m: MatchRecord, filter: PosFilter, champMap: Record<string, ChampionData>): boolean {
  if (filter === "ALL") return true;
  const role = (m.role ?? "").toUpperCase();
  if (role && role !== "NONE" && role !== "INVALID") return ROLE_MATCH[filter].includes(role);
  const champ = champMap[m.championName];
  return champ ? filterByPosition(champ, filter) : false;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayerProfilePage() {
  const { puuid } = useParams<{ puuid: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [ddVersion, setDdVersion] = useState("14.24.1");
  const [champMap, setChampMap] = useState<Record<string, ChampionData>>({});
  const { selected: queueFilter, toggle: toggleQueue, passes: queuePasses } = useQueueFilter();
  const [champPosFilter, setChampPosFilter] = useState<PosFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lpPanelOpen, setLpPanelOpen] = useState(false);
  const [lpText, setLpText] = useState("");
  const [lpStatus, setLpStatus] = useState<string | null>(null);
  const [lpSubmitting, setLpSubmitting] = useState(false);

  useEffect(() => {
    if (!puuid) return;
    Promise.all([getPlayer(puuid), getDDVersion(), getChampions(), getTournamentTeams()]).then(([p, { version }, champs, teams]) => {
      setProfile(p);
      setDdVersion(version);
      const m: Record<string, ChampionData> = {};
      for (const c of champs) { m[c.id] = c; m[c.name] = c; }
      setChampMap(m);
      setLoading(false);
      const entry = (teams as TournamentTeam[]).flatMap((t) => t.roster).find((r) => r.puuid === puuid);
      const pos = entry?.position;
      if (pos && pos !== "FILL" && pos !== "SUB") setChampPosFilter(pos as PosFilter);
    });
  }, [puuid]);

  const allMatches: MatchRecord[] = profile
    ? (profile.matchHistory?.length ? profile.matchHistory : profile.recentMatches ?? [])
    : [];

  const queuesPresent = useMemo(
    () => [...new Set(allMatches.map((m) => m.queueId).filter(Boolean))] as number[],
    [allMatches.length]
  );

  const matches = allMatches
    .filter((m) => queuePasses(m.queueId))
    .filter((m) => matchFitsRole(m, champPosFilter, champMap));

  const champStats = useMemo(() => computeChampStats(matches), [matches]);

  // Overall stats
  const overall = useMemo(() => {
    if (!matches.length) return null;
    let wins = 0, k = 0, d = 0, a = 0, csMin = 0, csMinN = 0, dmg = 0, dmgN = 0;
    for (const m of matches) {
      if (m.win) wins++;
      k += m.kda.kills; d += m.kda.deaths; a += m.kda.assists;
      if (m.csPerMin != null) { csMin += m.csPerMin; csMinN++; }
      if (m.damage != null) { dmg += m.damage; dmgN++; }
    }
    const n = matches.length;
    return {
      games: n, wins, losses: n - wins,
      wr: Math.round((wins / n) * 100),
      kda: d === 0 ? "∞" : ((k + a) / d).toFixed(2),
      avgK: (k / n).toFixed(1), avgD: (d / n).toFixed(1), avgA: (a / n).toFixed(1),
      avgCsMin: csMinN > 0 ? (csMin / csMinN).toFixed(1) : null,
      avgDmg: dmgN > 0 ? Math.round(dmg / dmgN) : null,
    };
  }, [matches]);

  async function handleLpImport() {
    if (!puuid || !lpText.trim()) return;
    setLpSubmitting(true);
    setLpStatus(null);
    try {
      const payload = JSON.parse(lpText);
      const { matched, total } = await submitLpHistory(puuid, payload);
      setLpStatus(`Matched ${matched}/${total} games`);
      const updated = await getPlayer(puuid);
      setProfile(updated);
      setLpText("");
    } catch (e) {
      setLpStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLpSubmitting(false);
    }
  }

  async function handleRefresh() {
    if (!puuid) return;
    setRefreshing(true);
    try {
      await refreshPlayer(puuid);
      const updated = await getPlayer(puuid);
      setProfile(updated);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <div style={{ color: "#cbd5e1", padding: 40, textAlign: "center" }}>Loading…</div>;
  }
  if (!profile) {
    return <div style={{ color: "#f87171", padding: 40, textAlign: "center" }}>Player not found.</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24, padding: "20px 24px", background: "#16213e", borderRadius: 12, border: "1px solid #2d2d4e" }}>
        <img src={profileIconUrl(ddVersion, profile.profileIconId)} width={80} height={80}
          style={{ borderRadius: 12, border: "3px solid #2d2d4e", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            {profile.gameName}<span style={{ color: "#8899aa", fontWeight: 400 }}>#{profile.tagLine}</span>
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}>
            Level {profile.summonerLevel}
            {profile.ranked.soloQueue && (
              <span style={{ marginLeft: 12 }}>
                <RankBadge entry={profile.ranked.soloQueue} showLP />
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>
            Updated {new Date(profile.lastUpdated).toLocaleString()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary">
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={() => { setLpPanelOpen((o) => !o); setLpStatus(null); }} className="btn-secondary">
            LP Import
          </button>
          <button onClick={() => navigate("/players")} className="btn-secondary">← Back</button>
        </div>
      </div>

      {/* ── Rank cards ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <RankCard label="Ranked Solo/Duo" entry={profile.ranked.soloQueue} />
        <RankCard label="Ranked Flex" entry={profile.ranked.flexQueue} />
      </div>

      {/* ── LP import panel ── */}
      {lpPanelOpen && (
        <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>
            Paste the full Mobalytics GraphQL response for this player:
          </div>
          <textarea
            value={lpText}
            onChange={(e) => setLpText(e.target.value)}
            placeholder='{ "data": { "lol": { "player": { "lpHistory": ... } } } }'
            style={{ width: "100%", height: 120, background: "#0f172a", color: "#e2e8f0", border: "1px solid #2d2d4e", borderRadius: 6, padding: 10, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button onClick={handleLpImport} disabled={lpSubmitting || !lpText.trim()} className="btn-primary">
              {lpSubmitting ? "Importing…" : "Import LP"}
            </button>
            {lpStatus && (
              <span style={{ fontSize: 13, color: lpStatus.startsWith("Error") ? "#f87171" : "#4ade80" }}>{lpStatus}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Elo charts ── */}
      {(() => {
        const soloLpMatches = allMatches.filter((m) => m.lpAfter != null && m.queueId === 420);
        const flexLpMatches = allMatches.filter((m) => m.lpAfter != null && m.queueId === 440);
        const hasLpData = soloLpMatches.length > 0 || flexLpMatches.length > 0;
        if (hasLpData) {
          return (
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              {soloLpMatches.length > 0 && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <LpChart matches={soloLpMatches} label="Solo/Duo LP History" />
                </div>
              )}
              {flexLpMatches.length > 0 && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <LpChart matches={flexLpMatches} label="Flex LP History" />
                </div>
              )}
            </div>
          );
        }
        if (profile.rankedHistory && profile.rankedHistory.length >= 1) {
          return (
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <RankChart history={profile.rankedHistory} queue="soloQueue" label="Solo/Duo Rank History" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <RankChart history={profile.rankedHistory} queue="flexQueue" label="Flex Rank History" />
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* ── Filters ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <FilterRow label="Queue">
          <button onClick={() => toggleQueue("all")} style={{
            padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
            border: queueFilter.size === 0 ? "1px solid #3b82f6" : "1px solid #2d2d4e",
            background: queueFilter.size === 0 ? "#1d4ed8" : "#16213e",
            color: queueFilter.size === 0 ? "#fff" : "#cbd5e1",
            fontWeight: queueFilter.size === 0 ? 600 : 400,
          }}>All ({allMatches.length})</button>
          {queuesPresent.map((q) => {
            const active = queueFilter.has(q);
            return (
              <button key={q} onClick={() => toggleQueue(q)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: active ? "1px solid #3b82f6" : "1px solid #2d2d4e",
                background: active ? "#1d4ed8" : "#16213e",
                color: active ? "#fff" : "#cbd5e1",
                fontWeight: active ? 600 : 400,
              }}>{queueLabel(q)} ({allMatches.filter((m) => m.queueId === q).length})</button>
            );
          })}
        </FilterRow>
        <FilterRow label="Role">
          {(["ALL", "TOP", "JUNGLE", "MID", "BOT", "SUPPORT"] as PosFilter[]).map((f) => (
            <button key={f} onClick={() => setChampPosFilter(f)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: champPosFilter === f ? "1px solid #3b82f6" : "1px solid #2d2d4e",
              background: champPosFilter === f ? "#1d4ed8" : "#16213e",
              color: champPosFilter === f ? "#fff" : "#cbd5e1",
              fontWeight: champPosFilter === f ? 600 : 400,
            }}>
              {f === "ALL" ? "All" : f === "JUNGLE" ? "JGL" : f === "SUPPORT" ? "SUP" : f === "BOT" ? "ADC" : f}
            </button>
          ))}
        </FilterRow>
      </div>

      {/* ── Main layout: sidebar + games ── */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* Left sidebar */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Overall stats */}
          {overall && (
            <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 11, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                {overall.games}G Summary
              </div>
              {/* Win/loss bar */}
              <div style={{ display: "flex", gap: 3, marginBottom: 12, alignItems: "flex-end" }}>
                {matches.slice(0, 30).map((m, i) => (
                  <div key={i} style={{ width: 6, height: m.win ? 24 : 14, borderRadius: 2, background: m.win ? "#4ade80" : "#f87171", flexShrink: 0 }} />
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: overall.wr >= 50 ? "#4ade80" : "#f87171" }}>{overall.wr}%</div>
                  <div style={{ fontSize: 11, color: "#8899aa" }}>{overall.wins}W {overall.losses}L</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: parseFloat(overall.kda) >= 3 ? "#4ade80" : "#e2e8f0" }}>{overall.kda}:1</div>
                  <div style={{ fontSize: 11, color: "#8899aa" }}>{overall.avgK}/{overall.avgD}/{overall.avgA}</div>
                </div>
                {overall.avgCsMin && (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#cbd5e1" }}>{overall.avgCsMin}</div>
                    <div style={{ fontSize: 11, color: "#8899aa" }}>CS/min</div>
                  </div>
                )}
                {overall.avgDmg && (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#f59e0b" }}>{fmtK(overall.avgDmg)}</div>
                    <div style={{ fontSize: 11, color: "#8899aa" }}>avg dmg</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Champion stats */}
          {champStats.length > 0 && (
            <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 11, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                Champions
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {champStats.slice(0, 10).map((cs) => {
                  const champ = champMap[cs.name];
                  return (
                    <div key={cs.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "#0f172a" }}>
                        {champ && <img src={champIconUrl(ddVersion, champ.image.full)} width={32} height={32} style={{ display: "block" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cs.name}</span>
                          <span style={{ fontSize: 11, color: cs.winrate >= 50 ? "#4ade80" : "#f87171", flexShrink: 0, marginLeft: 4 }}>{cs.winrate}%</span>
                        </div>
                        <div style={{ height: 4, background: "#1e293b", borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
                          <div style={{ width: `${cs.winrate}%`, height: "100%", background: cs.winrate >= 50 ? "#4ade80" : "#f87171" }} />
                        </div>
                        <div style={{ fontSize: 10, color: "#8899aa", marginTop: 2 }}>
                          {cs.games}G · {cs.kda >= 99 ? "∞" : cs.kda.toFixed(2)} KDA
                          {cs.avgCsMin != null && ` · ${cs.avgCsMin.toFixed(1)} cs/m`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mastery */}
          {profile.topChampions.length > 0 && (
            <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 11, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Mastery</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {profile.topChampions.map((c) => {
                  const champ = champMap[c.championName];
                  const col = c.level >= 10 ? "#f59e0b" : c.level >= 7 ? "#9b59b6" : c.level >= 5 ? "#3dd9a0" : "#cbd5e1";
                  return (
                    <div key={c.championName} title={`${c.championName} M${c.level} — ${c.championPoints.toLocaleString()} pts`}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: 48 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", border: `2px solid ${col}` }}>
                        {champ && <img src={champIconUrl(ddVersion, champ.image.full)} width={40} height={40} style={{ display: "block" }} />}
                      </div>
                      <div style={{ fontSize: 9, color: col, fontWeight: 700 }}>M{c.level}</div>
                      <div style={{ fontSize: 9, color: "#cbd5e1" }}>{(c.championPoints / 1000).toFixed(0)}k</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rank history */}
          {profile.rankedHistory && profile.rankedHistory.length > 1 && (
            <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 11, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Rank History</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[...profile.rankedHistory].reverse().map((snap, i) => (
                  <div key={i} style={{ fontSize: 12 }}>
                    <div style={{ color: "#cbd5e1", fontSize: 10, marginBottom: 1 }}>{new Date(snap.timestamp).toLocaleDateString()}</div>
                    {snap.soloQueue && (
                      <div>Solo: <RankBadge entry={snap.soloQueue} showLP size="sm" /></div>
                    )}
                    {snap.flexQueue && (
                      <div style={{ fontSize: 11 }}>Flex: <RankBadge entry={snap.flexQueue} size="sm" /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — game list */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 13, color: "#8899aa", marginBottom: 4 }}>
            {matches.length} games
          </div>
          {matches.map((m) => (
            <GameRow key={m.matchId} match={m} champMap={champMap} ddVersion={ddVersion} />
          ))}
          {matches.length === 0 && (
            <div style={{ color: "#cbd5e1", padding: 40, textAlign: "center", background: "#16213e", borderRadius: 10, border: "1px solid #2d2d4e" }}>
              No games found. Hit Refresh to fetch recent data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
