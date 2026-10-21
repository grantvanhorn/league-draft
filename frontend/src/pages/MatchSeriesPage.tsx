import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMatchWeek, updateSeriesSubstitutes, getChampions, getDDVersion, getTournamentTeams } from "../lib/api";
import { ChampionData, TournamentTeam } from "../types";
import { champIconUrl } from "../lib/ddragon";

const itemIconUrl = (v: string, id: number) =>
  id > 0 ? `https://ddragon.leagueoflegends.com/cdn/${v}/img/item/${id}.png` : null;

const TEAM_POS_TO_ROSTER: Record<string, string> = {
  TOP: "TOP", JUNGLE: "JUNGLE", MIDDLE: "MID",
  BOTTOM: "BOT", UTILITY: "SUPPORT",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface SeriesSubstitute {
  riotIdGameName: string;
  replacingRiotId: string;
  teamId: string;
}

interface Participant {
  puuid: string; summonerName: string; riotIdGameName: string; championName: string;
  teamId: number; kills: number; deaths: number; assists: number; win: boolean;
  totalDamageDealtToChampions: number; goldEarned: number;
  totalMinionsKilled: number; neutralMinionsKilled: number;
  teamPosition: string; visionScore: number;
  item0: number; item1: number; item2: number; item3: number;
  item4: number; item5: number; item6: number;
}

interface TeamInfo {
  teamId: number; win: boolean;
  bans: { championId: number; pickTurn: number }[];
  objectives: {
    baron: { kills: number }; dragon: { kills: number }; tower: { kills: number };
    inhibitor: { kills: number }; riftHerald: { kills: number }; champion: { kills: number };
  };
}

interface SeriesGame {
  gameNumber: number; matchId: string; fetchedAt?: string;
  data?: { info: { gameDuration: number; gameStartTimestamp: number; participants: Participant[]; teams?: TeamInfo[] } };
}

interface MatchSeries {
  id: string; teamAId: string; teamBId: string;
  games: SeriesGame[]; substitutes?: SeriesSubstitute[];
}

interface RoleSwap {
  riotIdGameName: string; rosterPos: string; playedPos: string; isSub: boolean;
}

// ─── Role swap detection ──────────────────────────────────────────────────────
function detectRoleSwaps(ps: Participant[], team: TournamentTeam | undefined, subs: SeriesSubstitute[]): RoleSwap[] {
  if (!team) return [];
  const subsByName: Record<string, SeriesSubstitute> = {};
  for (const s of subs) subsByName[s.riotIdGameName] = s;
  const result: RoleSwap[] = [];

  for (const p of ps) {
    const playedPos = TEAM_POS_TO_ROSTER[p.teamPosition] ?? p.teamPosition;
    const sub = subsByName[p.riotIdGameName];
    if (sub) {
      const replaced = team.roster.find(
        (r) => r.riotId.split("#")[0].toLowerCase() === sub.replacingRiotId.split("#")[0].toLowerCase()
      );
      const replacedPos = replaced?.position ?? "?";
      if (playedPos !== replacedPos)
        result.push({ riotIdGameName: p.riotIdGameName, rosterPos: replacedPos, playedPos, isSub: true });
    } else {
      const entry = team.roster.find(
        (r) => r.riotId.split("#")[0].toLowerCase() === p.riotIdGameName.toLowerCase()
      );
      if (entry && entry.position !== "FILL" && entry.position !== "SUB" && playedPos !== entry.position)
        result.push({ riotIdGameName: p.riotIdGameName, rosterPos: entry.position, playedPos, isSub: false });
    }
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fmtGold(g: number) {
  return g >= 1000 ? `${(g / 1000).toFixed(1)}k` : String(g);
}

// ─── Item strip ───────────────────────────────────────────────────────────────
function ItemStrip({ p, ddVersion }: { p: Participant; ddVersion: string }) {
  const slots = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5];
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {slots.map((id, i) => {
        const url = itemIconUrl(ddVersion, id);
        return url
          ? <img key={i} src={url} width={28} height={28} style={{ borderRadius: 4, border: "1px solid #2d2d4e" }} alt="" />
          : <div key={i} style={{ width: 28, height: 28, borderRadius: 4, background: "#1e293b", border: "1px solid #1e293b" }} />;
      })}
      <div style={{ width: 3 }} />
      {p.item6 > 0 && itemIconUrl(ddVersion, p.item6)
        ? <img src={itemIconUrl(ddVersion, p.item6)!} width={28} height={28} style={{ borderRadius: 4, border: "1px solid #2d2d4e", opacity: 0.7 }} alt="" />
        : <div style={{ width: 28, height: 28, borderRadius: 4, background: "#1e293b", opacity: 0.35 }} />}
    </div>
  );
}

// ─── Bans row ─────────────────────────────────────────────────────────────────
function BansRow({ bans, champByKey, ddVersion }: {
  bans: { championId: number }[]; champByKey: Record<number, ChampionData>; ddVersion: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginRight: 2 }}>bans</span>
      {bans.map((b, i) => {
        const champ = champByKey[b.championId];
        return champ ? (
          <div key={i} style={{ position: "relative", width: 28, height: 28 }}>
            <img src={champIconUrl(ddVersion, champ.image.full)} width={28} height={28}
              style={{ borderRadius: 4, filter: "grayscale(1) brightness(0.45)" }} alt={champ.name} title={champ.name} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 1, height: 34, background: "#f87171", transform: "rotate(45deg)", position: "absolute" }} />
            </div>
          </div>
        ) : <div key={i} style={{ width: 28, height: 28, borderRadius: 4, background: "#1e293b" }} />;
      })}
    </div>
  );
}

// ─── Game Scoreboard ──────────────────────────────────────────────────────────
function GameScoreboard({ game, teamA, teamB, aIsBlue, champMap, champByKey, ddVersion, subInfo }: {
  game: SeriesGame; teamA?: TournamentTeam; teamB?: TournamentTeam; aIsBlue: boolean;
  champMap: Record<string, ChampionData>; champByKey: Record<number, ChampionData>;
  ddVersion: string; subInfo: Record<string, SeriesSubstitute>;
}) {
  if (!game.data) return (
    <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Game data not yet fetched</div>
  );
  const { participants, teams, gameDuration } = game.data.info;
  const blue = participants.filter((p) => p.teamId === 100);
  const red = participants.filter((p) => p.teamId === 200);
  const teamAPs = aIsBlue ? blue : red;
  const teamBPs = aIsBlue ? red : blue;
  const teamAInfo = teams?.find((t) => t.teamId === (aIsBlue ? 100 : 200));
  const teamBInfo = teams?.find((t) => t.teamId === (aIsBlue ? 200 : 100));
  const teamAWon = teamAPs[0]?.win ?? false;
  const maxDmg = Math.max(...participants.map((p) => p.totalDamageDealtToChampions), 1);

  const aTeamSubs = Object.values(subInfo).filter((s) => s.teamId === teamA?.id);
  const bTeamSubs = Object.values(subInfo).filter((s) => s.teamId === teamB?.id);
  const aSwaps = detectRoleSwaps(teamAPs, teamA, aTeamSubs);
  const bSwaps = detectRoleSwaps(teamBPs, teamB, bTeamSubs);
  const swapMap: Record<string, RoleSwap> = {};
  for (const sw of [...aSwaps, ...bSwaps]) swapMap[sw.riotIdGameName] = sw;

  function TeamBlock({ ps, team, info, won, accentColor }: {
    ps: Participant[]; team?: TournamentTeam; info?: TeamInfo; won: boolean; accentColor: string;
  }) {
    const totalK = ps.reduce((s, p) => s + p.kills, 0);
    const totalD = ps.reduce((s, p) => s + p.deaths, 0);
    const totalA = ps.reduce((s, p) => s + p.assists, 0);
    const totalGold = ps.reduce((s, p) => s + p.goldEarned, 0);
    return (
      <div style={{ background: won ? "rgba(22,101,52,0.12)" : "rgba(127,29,29,0.12)", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
          background: won ? "rgba(22,101,52,0.22)" : "rgba(127,29,29,0.18)",
          borderBottom: `1px solid ${won ? "#166534" : "#7f1d1d"}`,
        }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: accentColor }}>{team?.name ?? "—"}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: won ? "#4ade80" : "#f87171", background: won ? "#166534" : "#7f1d1d", padding: "2px 8px", borderRadius: 10 }}>
            {won ? "VICTORY" : "DEFEAT"}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
            {totalK} / <span style={{ color: "#f87171" }}>{totalD}</span> / {totalA}
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 4 }}>{fmtGold(totalGold)}</span>
          {info && (
            <div style={{ display: "flex", gap: 10, fontSize: 11, marginLeft: 10 }}>
              {[
                { e: "🏰", v: info.objectives.tower.kills, t: "Towers" },
                { e: "🐉", v: info.objectives.dragon.kills, t: "Dragons" },
                { e: "🐛", v: info.objectives.baron.kills, t: "Barons" },
                { e: "🔮", v: info.objectives.riftHerald.kills, t: "Heralds" },
                { e: "🏚", v: info.objectives.inhibitor.kills, t: "Inhibitors" },
              ].map(({ e, v, t }) => (
                <span key={t} title={t} style={{ opacity: v > 0 ? 1 : 0.25, color: "#94a3b8" }}>
                  {e} <b style={{ color: v > 0 ? "#e2e8f0" : "#94a3b8" }}>{v}</b>
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Column header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 16px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ width: 40 }} /><div style={{ width: 140 }} /><div style={{ flex: 1 }} />
          <div style={{ width: 210, fontSize: 10, color: "#94a3b8", textAlign: "right" }}>Items</div>
          <div style={{ width: 72, fontSize: 10, color: "#94a3b8", textAlign: "center" }}>KDA</div>
          <div style={{ width: 44, fontSize: 10, color: "#94a3b8", textAlign: "right" }}>CS</div>
          <div style={{ width: 92, fontSize: 10, color: "#94a3b8", textAlign: "right" }}>Damage</div>
          <div style={{ width: 44, fontSize: 10, color: "#94a3b8", textAlign: "right" }}>Gold</div>
          <div style={{ width: 28, fontSize: 10, color: "#94a3b8", textAlign: "right" }}>👁</div>
        </div>
        {/* Players */}
        {ps.map((p, i) => {
          const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
          const isSub = !!subInfo[p.riotIdGameName];
          const swap = swapMap[p.riotIdGameName];
          const name = p.riotIdGameName || p.summonerName || p.championName;
          const dmgPct = p.totalDamageDealtToChampions / maxDmg;
          const kdaVal = p.deaths === 0 ? (p.kills + p.assists) : (p.kills + p.assists) / p.deaths;
          const kdaStr = p.deaths === 0 ? `${kdaVal.toFixed(0)}.0` : kdaVal.toFixed(1);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 16px",
              borderBottom: i < ps.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <img src={champIconUrl(ddVersion, champMap[p.championName]?.image.full ?? `${p.championName}.png`)}
                width={40} height={40} style={{ borderRadius: 5, flexShrink: 0 }} alt={p.championName} title={p.championName} />
              <div style={{ width: 140 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 94 }}>{name}</span>
                  {isSub && <span style={{ fontSize: 9, color: "#f59e0b", background: "#2d1f06", padding: "1px 4px", borderRadius: 3, fontWeight: 700, flexShrink: 0 }}>SUB</span>}
                  {swap && <span title={`Normally ${swap.rosterPos}`} style={{ fontSize: 9, color: "#a78bfa", background: "#1e1040", padding: "1px 4px", borderRadius: 3, fontWeight: 700, flexShrink: 0 }}>{swap.playedPos}</span>}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{p.championName}</div>
              </div>
              <div style={{ flex: 1 }} />
              <ItemStrip p={p} ddVersion={ddVersion} />
              <div style={{ width: 72, textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                  {p.kills}/<span style={{ color: "#f87171" }}>{p.deaths}</span>/{p.assists}
                </div>
                <div style={{ fontSize: 10, color: parseFloat(kdaStr) >= 5 ? "#f59e0b" : "#94a3b8" }}>{kdaStr} KDA</div>
              </div>
              <div style={{ width: 44, textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#cbd5e1" }}>{cs}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{gameDuration > 0 ? (cs / (gameDuration / 60)).toFixed(1) : "0"}/m</div>
              </div>
              <div style={{ width: 92, display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 11, color: "#cbd5e1", textAlign: "right" }}>{Math.round(p.totalDamageDealtToChampions / 1000)}k</div>
                <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${dmgPct * 100}%`, background: accentColor, borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ width: 44, textAlign: "right", fontSize: 12, color: "#94a3b8" }}>{fmtGold(p.goldEarned)}</div>
              <div style={{ width: 28, textAlign: "right", fontSize: 11, color: "#94a3b8" }}>{p.visionScore}</div>
            </div>
          );
        })}
        {info && info.bans.length > 0 && (
          <div style={{ padding: "8px 16px", borderTop: "1px solid #1e293b" }}>
            <BansRow bans={info.bans} champByKey={champByKey} ddVersion={ddVersion} />
          </div>
        )}
      </div>
    );
  }

  // Always render blue side first, red side second
  const blueTeam = aIsBlue ? teamA : teamB;
  const redTeam  = aIsBlue ? teamB : teamA;
  const bluePs   = teamAPs; // aIsBlue means teamAPs = blue
  const redPs2   = teamBPs;
  const blueInfo = teamAInfo;
  const redInfo  = teamBInfo;
  const blueWon2 = teamAWon;

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ textAlign: "right", fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
        {fmtDuration(gameDuration)} · {new Date(game.data.info.gameStartTimestamp).toLocaleDateString()}
      </div>
      <TeamBlock ps={bluePs}  team={blueTeam} info={blueInfo} won={blueWon2}  accentColor="#60a5fa" />
      <TeamBlock ps={redPs2}  team={redTeam}  info={redInfo}  won={!blueWon2} accentColor="#f87171" />
    </div>
  );
}

// ─── Manage Subs Modal ────────────────────────────────────────────────────────
function ManageSubsModal({ series, teams, weekId, onClose, onSaved }: {
  series: MatchSeries; teams: TournamentTeam[]; weekId: string;
  onClose: () => void; onSaved: (s: MatchSeries) => void;
}) {
  const teamA = teams.find((t) => t.id === series.teamAId);
  const teamB = teams.find((t) => t.id === series.teamBId);
  const [subs, setSubs] = useState<SeriesSubstitute[]>(series.substitutes ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newTeamId, setNewTeamId] = useState(series.teamAId);
  const [newReplacing, setNewReplacing] = useState("");
  const teamForSub = teams.find((t) => t.id === newTeamId);
  const inp = { width: "100%", padding: "6px 8px", borderRadius: 5, border: "1px solid #2d2d4e", background: "#16213e", color: "#e2e8f0", fontSize: 13, boxSizing: "border-box" as const, outline: "none" };

  function addSub() {
    if (!newName.trim()) { setError("Enter the sub's in-game name"); return; }
    if (!newReplacing) { setError("Select who they're replacing"); return; }
    setSubs([...subs, { riotIdGameName: newName.trim(), replacingRiotId: newReplacing, teamId: newTeamId }]);
    setNewName(""); setNewReplacing(""); setError("");
  }
  async function save() {
    setSaving(true);
    try { await updateSeriesSubstitutes(weekId, series.id, subs); onSaved({ ...series, substitutes: subs }); }
    catch (e: any) { setError(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 12, padding: 24, width: 500 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 4px", color: "#e2e8f0" }}>Substitutes</h3>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>{teamA?.abbreviation} vs {teamB?.abbreviation}</div>
        {subs.map((s, i) => {
          const t = teams.find((t) => t.id === s.teamId);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#0f172a", borderRadius: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{s.riotIdGameName}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>for</span>
              <span style={{ fontSize: 13, color: "#cbd5e1" }}>{s.replacingRiotId}</span>
              <span style={{ fontSize: 11, color: "#60a5fa", background: "#1e3a5f", padding: "1px 6px", borderRadius: 8 }}>{t?.abbreviation ?? s.teamId}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setSubs(subs.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
            </div>
          );
        })}
        <div style={{ background: "#0f172a", borderRadius: 8, padding: 14, marginTop: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Add Substitute</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>In-game name</div>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="SeagullPrincess" style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Subbing for team</div>
              <select value={newTeamId} onChange={(e) => { setNewTeamId(e.target.value); setNewReplacing(""); }} style={inp}>
                {[teamA, teamB].filter(Boolean).map((t) => <option key={t!.id} value={t!.id}>{t!.abbreviation} — {t!.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Replacing</div>
            <select value={newReplacing} onChange={(e) => setNewReplacing(e.target.value)} style={inp}>
              <option value="">— select player —</option>
              {teamForSub?.roster.map((r) => <option key={r.riotId} value={r.riotId}>{r.riotId}</option>)}
            </select>
          </div>
          {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button className="btn-secondary" onClick={addSub} style={{ fontSize: 12, width: "100%" }}>+ Add Sub</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving} style={{ flex: 1 }}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MatchSeriesPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();

  const [series, setSeries] = useState<MatchSeries | null>(null);
  const [weekId, setWeekId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [ddVersion, setDdVersion] = useState("14.24.1");
  const [activeGame, setActiveGame] = useState(1);
  const [showSubModal, setShowSubModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seriesId) return;
    // Derive weekId: "week-1-TBM-UNC" → "week-1"
    const match = seriesId.match(/^(week-\d+)/);
    const wId = match ? match[1] : seriesId.split("-").slice(0, 2).join("-");
    setWeekId(wId);

    Promise.all([getTournamentTeams(), getChampions(), getDDVersion(), getMatchWeek(wId)]).then(
      ([ts, cs, { version }, week]) => {
        setTeams(ts);
        setChampions(cs);
        setDdVersion(version);
        const found = week.series.find((s: MatchSeries) => s.id === seriesId);
        setSeries(found ?? null);
        const firstGame = found?.games.find((g: SeriesGame) => g.data);
        if (firstGame) setActiveGame(firstGame.gameNumber);
        setLoading(false);
      }
    );
  }, [seriesId]);

  const champMap = useMemo(() => {
    const m: Record<string, ChampionData> = {};
    for (const c of champions) { m[c.id] = c; m[c.name] = c; }
    return m;
  }, [champions]);

  const champByKey = useMemo(() => {
    const m: Record<number, ChampionData> = {};
    for (const c of champions) { m[parseInt(c.key)] = c; }
    return m;
  }, [champions]);

  const subInfo = useMemo(() => {
    const m: Record<string, SeriesSubstitute> = {};
    for (const s of series?.substitutes ?? []) m[s.riotIdGameName] = s;
    return m;
  }, [series?.substitutes]);

  const teamA = teams.find((t) => t.id === series?.teamAId);
  const teamB = teams.find((t) => t.id === series?.teamBId);

  const aPlayers = useMemo(() => new Set(teamA?.roster.map((r) => r.puuid).filter(Boolean) as string[]), [teamA]);
  const aSubNames = useMemo(() => new Set(
    series?.substitutes?.filter((s) => s.teamId === series.teamAId).map((s) => s.riotIdGameName) ?? []
  ), [series?.substitutes, series?.teamAId]);

  function blueIsA(game: SeriesGame): boolean {
    if (!game.data) return true;
    const blue = game.data.info.participants.filter((p) => p.teamId === 100);
    return blue.some((p) => aPlayers.has(p.puuid) || aSubNames.has(p.riotIdGameName));
  }

  const { aWins, bWins } = useMemo(() => {
    let aWins = 0, bWins = 0;
    for (const g of series?.games ?? []) {
      if (!g.data) continue;
      const blueWon = g.data.info.participants.find((p) => p.teamId === 100)?.win ?? false;
      const aBlue = blueIsA(g);
      if (blueWon) { aBlue ? aWins++ : bWins++; } else { aBlue ? bWins++ : aWins++; }
    }
    return { aWins, bWins };
  }, [series?.games, aPlayers, aSubNames]);

  // All role swaps across the series
  const allRoleSwaps = useMemo(() => {
    const seen = new Set<string>();
    const result: RoleSwap[] = [];
    for (const g of series?.games ?? []) {
      if (!g.data) continue;
      const aPs = g.data.info.participants.filter((p) => p.teamId === (blueIsA(g) ? 100 : 200));
      const bPs = g.data.info.participants.filter((p) => p.teamId === (blueIsA(g) ? 200 : 100));
      const aTeamSubs = Object.values(subInfo).filter((s) => s.teamId === series!.teamAId);
      const bTeamSubs = Object.values(subInfo).filter((s) => s.teamId === series!.teamBId);
      for (const sw of [...detectRoleSwaps(aPs, teamA, aTeamSubs), ...detectRoleSwaps(bPs, teamB, bTeamSubs)]) {
        const key = `${sw.riotIdGameName}:${sw.playedPos}`;
        if (!seen.has(key)) { seen.add(key); result.push(sw); }
      }
    }
    return result;
  }, [series?.games, subInfo, teamA, teamB]);

  if (loading) return <div style={{ textAlign: "center", padding: 80, color: "#94a3b8" }}>Loading…</div>;
  if (!series) return (
    <div style={{ textAlign: "center", padding: 80, color: "#94a3b8" }}>
      Series not found.{" "}
      <button onClick={() => navigate("/matches")} style={{ color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>
        ← Back to Matches
      </button>
    </div>
  );

  const hasSubs = (series.substitutes?.length ?? 0) > 0;
  const aColor = teamA?.isOurTeam ? "#60a5fa" : "#cbd5e1";
  const bColor = teamB?.isOurTeam ? "#60a5fa" : "#cbd5e1";
  const currentGame = series.games.find((g) => g.gameNumber === activeGame);

  return (
    <div>
      {/* Back */}
      <button onClick={() => navigate("/matches")}
        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, padding: "0 0 16px 0", display: "flex", alignItems: "center", gap: 6 }}>
        ← Matches
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 0, padding: "16px 20px", background: "#16213e", borderRadius: "10px 10px 0 0", border: "1px solid #1e293b", borderBottom: "none" }}>
        <span style={{ fontWeight: 800, fontSize: 22, color: aColor }}>{teamA?.name ?? series.teamAId}</span>
        {series.games.some((g) => g.data) && (
          <span style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0", background: "#0f172a", padding: "3px 16px", borderRadius: 24 }}>
            {aWins}<span style={{ color: "#94a3b8", margin: "0 4px" }}>–</span>{bWins}
          </span>
        )}
        <span style={{ fontSize: 16, color: "#94a3b8" }}>vs</span>
        <span style={{ fontWeight: 800, fontSize: 22, color: bColor }}>{teamB?.name ?? series.teamBId}</span>
        {hasSubs && <span style={{ fontSize: 11, color: "#f59e0b", background: "#2d1f06", padding: "3px 10px", borderRadius: 10, fontWeight: 600 }}>SUBS</span>}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowSubModal(true)} style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "1px solid #2d2d4e", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
          Manage Subs
        </button>
      </div>

      {/* Subs + role swaps strip */}
      {(hasSubs || allRoleSwaps.length > 0) && (
        <div style={{ padding: "9px 20px", background: "rgba(245,158,11,0.05)", border: "1px solid #1e293b", borderTop: "none", borderBottom: "none", display: "flex", flexDirection: "column", gap: 5 }}>
          {series.substitutes!.map((s, i) => {
            const t = teams.find((t) => t.id === s.teamId);
            const subSwap = allRoleSwaps.find((sw) => sw.riotIdGameName === s.riotIdGameName && sw.isSub);
            return (
              <span key={i} style={{ fontSize: 12, color: "#cbd5e1" }}>
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>{s.riotIdGameName}</span>
                <span style={{ color: "#94a3b8" }}> subbing for </span>
                <span style={{ color: "#94a3b8" }}>{s.replacingRiotId.split("#")[0]}</span>
                <span style={{ color: "#60a5fa" }}> ({t?.abbreviation})</span>
                {subSwap && <span style={{ color: "#a78bfa" }}> · played {subSwap.playedPos} instead of {subSwap.rosterPos}</span>}
              </span>
            );
          })}
          {allRoleSwaps.filter((sw) => !sw.isSub).map((sw, i) => (
            <span key={`swap-${i}`} style={{ fontSize: 12, color: "#cbd5e1" }}>
              <span style={{ color: "#a78bfa", fontWeight: 700 }}>{sw.riotIdGameName}</span>
              <span style={{ color: "#94a3b8" }}> moved to {sw.playedPos} (normally {sw.rosterPos})</span>
            </span>
          ))}
        </div>
      )}

      {/* Game tabs */}
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderTop: "none", borderBottom: "none" }}>
        {series.games.map((g) => {
          const hasData = !!g.data;
          const isActive = activeGame === g.gameNumber;
          // Always: blue side (teamId=100) on left, red side (teamId=200) on right
          const bluePs = hasData ? g.data!.info.participants.filter((p) => p.teamId === 100) : [];
          const redPs  = hasData ? g.data!.info.participants.filter((p) => p.teamId === 200) : [];
          const blueWon = hasData ? (g.data!.info.participants.find((p) => p.teamId === 100)?.win ?? false) : false;
          const aBlue = blueIsA(g);
          const blueTeam = aBlue ? teamA : teamB;
          const redTeam  = aBlue ? teamB : teamA;
          return (
            <div key={g.gameNumber}
              onClick={() => hasData && setActiveGame(g.gameNumber)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 20px",
                cursor: hasData ? "pointer" : "default",
                background: isActive ? "#1e293b" : "transparent",
                borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                opacity: hasData ? 1 : 0.4,
              }}>
              <span style={{ fontSize: 12, color: isActive ? "#3b82f6" : "#94a3b8", fontWeight: isActive ? 700 : 400, width: 52, flexShrink: 0 }}>
                Game {g.gameNumber}
              </span>
              {hasData ? (
                <>
                  {/* Blue side: left, labeled in blue */}
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", width: 34, textAlign: "right", flexShrink: 0 }}>{blueTeam?.abbreviation}</span>
                  <div style={{ display: "flex", gap: 2 }}>
                    {bluePs.map((p, i) => (
                      <img key={i} src={champIconUrl(ddVersion, champMap[p.championName]?.image.full ?? `${p.championName}.png`)}
                        width={32} height={32} style={{ borderRadius: 4, opacity: blueWon ? 1 : 0.4 }} alt={p.championName} title={p.championName} />
                    ))}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: blueWon ? "#4ade80" : "#f87171", width: 18, textAlign: "center" }}>
                    {blueWon ? "W" : "L"}
                  </span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>–</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: blueWon ? "#f87171" : "#4ade80", width: 18, textAlign: "center" }}>
                    {blueWon ? "L" : "W"}
                  </span>
                  {/* Red side: right, labeled in red */}
                  <div style={{ display: "flex", gap: 2 }}>
                    {redPs.map((p, i) => (
                      <img key={i} src={champIconUrl(ddVersion, champMap[p.championName]?.image.full ?? `${p.championName}.png`)}
                        width={32} height={32} style={{ borderRadius: 4, opacity: blueWon ? 0.4 : 1 }} alt={p.championName} title={p.championName} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171", width: 34, flexShrink: 0 }}>{redTeam?.abbreviation}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDuration(g.data!.info.gameDuration)}</span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Not fetched</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Scoreboard */}
      <div style={{ background: "#16213e", border: "1px solid #1e293b", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "0 20px" }}>
        {currentGame && (
          <GameScoreboard
            game={currentGame} teamA={teamA} teamB={teamB}
            aIsBlue={blueIsA(currentGame)}
            champMap={champMap} champByKey={champByKey}
            ddVersion={ddVersion} subInfo={subInfo}
          />
        )}
      </div>

      {showSubModal && weekId && (
        <ManageSubsModal
          series={series} teams={teams} weekId={weekId}
          onClose={() => setShowSubModal(false)}
          onSaved={(updated) => { setSeries(updated); setShowSubModal(false); }}
        />
      )}
    </div>
  );
}
