import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getTournamentTeam, getDDVersion, getChampions } from "../lib/api";
import { TournamentTeam, TournamentRosterEntry, PlayerProfile, MatchRecord, ChampionData, RankedSnapshot } from "../types";
import { profileIconUrl, champIconUrl, tierColor } from "../lib/ddragon";

// ── Types ─────────────────────────────────────────────────────────────────────

type PosFilter = "ALL" | "TOP" | "JUNGLE" | "MID" | "BOT" | "SUPPORT";

const POS_COLOR: Record<string, string> = {
  TOP: "#f59e0b", JUNGLE: "#22c55e", MID: "#3b82f6",
  BOT: "#a855f7", SUPPORT: "#ec4899", FILL: "#8899aa", SUB: "#8899aa",
};

const POS_ORDER = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];

const ROLE_MATCH: Record<string, string[]> = {
  ALL: [],
  TOP: ["TOP"],
  JUNGLE: ["JUNGLE"],
  MID: ["MIDDLE", "MID"],
  BOT: ["BOTTOM", "BOT", "CARRY"],
  SUPPORT: ["UTILITY", "SUPPORT"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function filterByChampType(champ: ChampionData, filter: PosFilter): boolean {
  if (filter === "ALL") return true;
  const t = champ.tags;
  if (filter === "TOP") return t.includes("Fighter") || (t.includes("Tank") && !t.includes("Support"));
  if (filter === "JUNGLE") return t.includes("Fighter") || (t.includes("Assassin") && !t.includes("Mage")) || t.includes("Tank");
  if (filter === "MID") return t.includes("Mage") || t.includes("Assassin");
  if (filter === "BOT") return t.includes("Marksman");
  if (filter === "SUPPORT") return t.includes("Support");
  return true;
}

function matchFitsRole(m: MatchRecord, filter: PosFilter, champMap: Record<string, ChampionData>): boolean {
  if (filter === "ALL") return true;
  const role = (m.role ?? "").toUpperCase();
  if (role && role !== "NONE" && role !== "INVALID") return (ROLE_MATCH[filter] ?? []).includes(role);
  const champ = champMap[m.championName];
  return champ ? filterByChampType(champ, filter) : false;
}

function normalizeRoleLabel(role?: string): string | null {
  if (!role) return null;
  const r = role.toUpperCase();
  if (r === "TOP") return "TOP";
  if (r === "JUNGLE") return "JGL";
  if (r === "MIDDLE" || r === "MID") return "MID";
  if (r === "BOTTOM" || r === "BOT" || r === "CARRY") return "BOT";
  if (r === "UTILITY" || r === "SUPPORT") return "SUP";
  return null;
}

function roleLabelColor(label: string): string {
  if (label === "TOP") return POS_COLOR.TOP;
  if (label === "JGL") return POS_COLOR.JUNGLE;
  if (label === "MID") return POS_COLOR.MID;
  if (label === "BOT") return POS_COLOR.BOT;
  if (label === "SUP") return POS_COLOR.SUPPORT;
  return "#8899aa";
}

interface ChampStat {
  name: string;
  games: number;
  wins: number;
  winrate: number;
  kda: number;
  avgK: number;
  avgD: number;
  avgA: number;
}

function computeChampStats(matches: MatchRecord[]): ChampStat[] {
  const map: Record<string, { w: number; l: number; k: number; d: number; a: number }> = {};
  for (const m of matches) {
    if (!map[m.championName]) map[m.championName] = { w: 0, l: 0, k: 0, d: 0, a: 0 };
    const s = map[m.championName];
    s[m.win ? "w" : "l"]++;
    s.k += m.kda.kills;
    s.d += m.kda.deaths;
    s.a += m.kda.assists;
  }
  return Object.entries(map)
    .map(([name, s]) => {
      const games = s.w + s.l;
      return {
        name, games, wins: s.w,
        winrate: Math.round((s.w / games) * 100),
        kda: s.d === 0 ? 99 : (s.k + s.a) / s.d,
        avgK: s.k / games, avgD: s.d / games, avgA: s.a / games,
      };
    })
    .sort((a, b) => b.games - a.games || b.winrate - a.winrate);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RankHistoryBadges({ history }: { history: RankedSnapshot[] }) {
  if (!history?.length) return null;

  const seen = new Set<string>();
  const badges: { label: string; tier: string }[] = [];
  for (const snap of [...history].reverse()) {
    if (!snap.soloQueue) continue;
    const month = snap.timestamp.slice(0, 7);
    if (seen.has(month)) continue;
    seen.add(month);
    const { tier, rank } = snap.soloQueue;
    badges.push({ label: `${tier[0]}${tier.slice(1).toLowerCase()} ${rank}`, tier });
    if (badges.length >= 4) break;
  }
  if (!badges.length) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {badges.map((b, i) => (
        <span key={i} style={{
          fontSize: 10, padding: "2px 6px", borderRadius: 4,
          background: `${tierColor(b.tier)}20`,
          color: tierColor(b.tier),
          border: `1px solid ${tierColor(b.tier)}40`,
          fontWeight: 600,
        }}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

function RoleDistribution({ matches }: { matches: MatchRecord[] }) {
  const groups: Record<string, { games: number; wins: number }> = {};
  for (const m of matches) {
    const label = normalizeRoleLabel(m.role);
    if (!label) continue;
    if (!groups[label]) groups[label] = { games: 0, wins: 0 };
    groups[label].games++;
    if (m.win) groups[label].wins++;
  }
  const total = Object.values(groups).reduce((n, g) => n + g.games, 0);
  if (!total) return null;

  const entries = Object.entries(groups).sort((a, b) => b[1].games - a[1].games).slice(0, 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {entries.map(([label, { games, wins }]) => {
        const pct = Math.round((games / total) * 100);
        const wr = Math.round((wins / games) * 100);
        const col = roleLabelColor(label);
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: col, minWidth: 28 }}>{label}</span>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#1e293b", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: col }} />
            </div>
            <span style={{ fontSize: 10, color: "#8899aa", minWidth: 28, textAlign: "right" }}>{pct}%</span>
            <span style={{ fontSize: 10, color: wr >= 50 ? "#4ade80" : "#f87171", minWidth: 30, textAlign: "right" }}>
              {wr}%W
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RecentGames({ matches, champMap, ddVersion }: {
  matches: MatchRecord[];
  champMap: Record<string, ChampionData>;
  ddVersion: string;
}) {
  const recent = matches.slice(0, 6);
  if (!recent.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {recent.map((m, i) => {
        const champ = champMap[m.championName];
        const deaths = m.kda.deaths;
        const ratio = deaths === 0 ? 99 : (m.kda.kills + m.kda.assists) / deaths;
        const ratioColor = ratio >= 3 ? "#4ade80" : ratio >= 2 ? "#cbd5e1" : "#f87171";
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "3px 6px",
            borderRadius: 5,
            borderLeft: `3px solid ${m.win ? "#4ade80" : "#f87171"}`,
            background: m.win ? "rgba(74,222,128,0.05)" : "rgba(248,113,113,0.05)",
          }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "#0f172a" }}>
              {champ && <img src={champIconUrl(ddVersion, champ.image.full)} width={20} height={20} style={{ display: "block" }} />}
            </div>
            <span style={{ fontSize: 10, color: "#e2e8f0", fontVariantNumeric: "tabular-nums", minWidth: 44 }}>
              {m.kda.kills}/{m.kda.deaths}/{m.kda.assists}
            </span>
            <span style={{ fontSize: 10, color: ratioColor, marginLeft: "auto" }}>
              {ratio === 99 ? "∞" : ratio.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ChampionStats({ stats, champMap, ddVersion }: {
  stats: ChampStat[];
  champMap: Record<string, ChampionData>;
  ddVersion: string;
}) {
  if (!stats.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {stats.slice(0, 10).map((cs) => {
        const champ = champMap[cs.name];
        return (
          <div key={cs.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: "#0f172a" }}>
              {champ && <img src={champIconUrl(ddVersion, champ.image.full)} width={26} height={26} style={{ display: "block" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cs.name}
                </span>
                <span style={{ fontSize: 11, color: cs.winrate >= 50 ? "#4ade80" : "#f87171", flexShrink: 0, marginLeft: 4, fontWeight: 600 }}>
                  {cs.winrate}%
                </span>
              </div>
              <div style={{ fontSize: 10, color: "#8899aa" }}>
                {cs.games}G · {cs.kda >= 99 ? "∞" : cs.kda.toFixed(1)} KDA
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlayerColumn({ entry, champMap, ddVersion }: {
  entry: TournamentRosterEntry;
  champMap: Record<string, ChampionData>;
  ddVersion: string;
}) {
  const posColor = POS_COLOR[entry.position] ?? "#8899aa";

  if (!entry.profile) {
    return (
      <div style={{
        width: 220, flexShrink: 0, background: "#16213e",
        border: `1px solid ${posColor}33`, borderRadius: 12, padding: 16,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 200,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: posColor }}>{entry.position}</div>
        <div style={{ fontSize: 13, color: "#cbd5e1", textAlign: "center" }}>{entry.riotId}</div>
        <div style={{ fontSize: 11, color: "#8899aa" }}>Not imported</div>
      </div>
    );
  }

  const profile = entry.profile as PlayerProfile;
  const posFilter = (entry.position !== "FILL" && entry.position !== "SUB" ? entry.position : "ALL") as PosFilter;

  const allMatches = profile.matchHistory?.length ? profile.matchHistory : profile.recentMatches ?? [];
  const rankedMatches = allMatches.filter((m) => !m.queueId || m.queueId === 420 || m.queueId === 440);
  const filteredMatches = useMemo(
    () => rankedMatches.filter((m) => matchFitsRole(m, posFilter, champMap)),
    [rankedMatches.length, posFilter, Object.keys(champMap).length]
  );
  const champStats = useMemo(() => computeChampStats(filteredMatches), [filteredMatches]);

  const soloQ = profile.ranked.soloQueue;
  const totalGames = soloQ ? soloQ.wins + soloQ.losses : 0;
  const soloWr = totalGames > 0 ? Math.round((soloQ!.wins / totalGames) * 100) : 0;

  return (
    <div style={{
      width: 220, flexShrink: 0, background: "#16213e",
      border: `1px solid ${posColor}44`, borderRadius: 12, padding: 14,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* Position + updated */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: posColor, textTransform: "uppercase", letterSpacing: 1 }}>
          {entry.position}
        </span>
        <span style={{ fontSize: 10, color: "#8899aa", marginLeft: "auto" }}>
          {timeAgo(profile.lastUpdated)}
        </span>
      </div>

      {/* Rank history badges */}
      <RankHistoryBadges history={profile.rankedHistory} />

      {/* Profile identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link to={`/players/${profile.puuid}`} style={{ flexShrink: 0 }}>
          <img
            src={profileIconUrl(ddVersion, profile.profileIconId)}
            width={46} height={46}
            style={{ borderRadius: 8, border: `2px solid ${posColor}66`, display: "block" }}
          />
        </Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {profile.gameName}
            <span style={{ color: "#8899aa", fontWeight: 400 }}>#{profile.tagLine}</span>
          </div>
          {soloQ ? (
            <div style={{ fontSize: 11, color: tierColor(soloQ.tier), fontWeight: 600, marginTop: 2 }}>
              {soloQ.tier[0]}{soloQ.tier.slice(1).toLowerCase()} {soloQ.rank} · {soloQ.leaguePoints} LP
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#8899aa", marginTop: 2 }}>Unranked</div>
          )}
        </div>
      </div>

      {/* W/L bar */}
      {soloQ && (
        <div>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 5 }}>
            <div style={{ width: `${soloWr}%`, background: "#4ade80" }} />
            <div style={{ flex: 1, background: "#f87171" }} />
          </div>
          <div style={{ display: "flex", fontSize: 11, gap: 4 }}>
            <span style={{ color: "#4ade80" }}>{soloQ.wins}W</span>
            <span style={{ color: "#f87171" }}>{soloQ.losses}L</span>
            <span style={{ color: soloWr >= 50 ? "#4ade80" : "#f87171", marginLeft: "auto", fontWeight: 700 }}>
              {soloWr}%
            </span>
          </div>
        </div>
      )}

      {/* Role distribution */}
      <RoleDistribution matches={allMatches} />

      {/* Divider */}
      <div style={{ borderTop: "1px solid #1e293b" }} />

      {/* Recent games (unfiltered by role — show all recent) */}
      <div>
        <div style={{ fontSize: 10, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          Recent
        </div>
        <RecentGames matches={allMatches} champMap={champMap} ddVersion={ddVersion} />
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid #1e293b" }} />

      {/* Champion stats (filtered by role) — flex-grow so it fills remaining height */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          <span>Champions</span>
          <span style={{ color: posColor, marginLeft: 4 }}>({posFilter === "ALL" ? "all" : posFilter.toLowerCase()})</span>
          <span style={{ marginLeft: 4, color: "#636e7e" }}>{filteredMatches.length}g</span>
        </div>
        <ChampionStats stats={champStats} champMap={champMap} ddVersion={ddVersion} />
        {champStats.length === 0 && (
          <div style={{ fontSize: 11, color: "#8899aa" }}>No games found for this role.</div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<TournamentTeam | null>(null);
  const [ddVersion, setDdVersion] = useState("14.24.1");
  const [champMap, setChampMap] = useState<Record<string, ChampionData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getTournamentTeam(id), getDDVersion(), getChampions()]).then(
      ([t, { version }, champs]) => {
        setTeam(t);
        setDdVersion(version);
        const m: Record<string, ChampionData> = {};
        for (const c of champs) { m[c.id] = c; m[c.name] = c; }
        setChampMap(m);
        setLoading(false);
      }
    );
  }, [id]);

  if (loading) return <div style={{ color: "#cbd5e1", padding: 40, textAlign: "center" }}>Loading…</div>;
  if (!team) return <div style={{ color: "#f87171", padding: 40, textAlign: "center" }}>Team not found.</div>;

  const starters = team.roster
    .filter((r) => r.position !== "SUB")
    .sort((a, b) => {
      const ai = POS_ORDER.indexOf(a.position);
      const bi = POS_ORDER.indexOf(b.position);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button onClick={() => navigate("/teams")} className="btn-secondary">← Teams</button>
        <h2 style={{ margin: 0 }}>{team.name}</h2>
        <span style={{ color: "#8899aa", fontSize: 14 }}>{team.division} Division</span>
        {team.isOurTeam && (
          <span style={{ fontSize: 12, background: "#1d4ed8", padding: "2px 9px", borderRadius: 10 }}>Us</span>
        )}
      </div>

      {/* 5-column layout — stretch so all columns reach the same height */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, alignItems: "stretch" }}>
        {starters.map((entry) => (
          <PlayerColumn
            key={entry.riotId}
            entry={entry}
            champMap={champMap}
            ddVersion={ddVersion}
          />
        ))}
      </div>
    </div>
  );
}
