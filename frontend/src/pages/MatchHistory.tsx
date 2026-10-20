import { useState, useEffect, useMemo } from "react";
import { getMatchWeeks, getMatchWeek, createMatchWeek, fetchWeekData, WeekSummary, getChampions, getDDVersion, getTournamentTeams } from "../lib/api";
import { ChampionData, TournamentTeam } from "../types";
import { champIconUrl } from "../lib/ddragon";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SeriesGame {
  gameNumber: number;
  matchId: string;
  fetchedAt?: string;
  data?: {
    info: {
      gameDuration: number;
      gameStartTimestamp: number;
      participants: {
        puuid: string;
        summonerName: string;
        championName: string;
        teamId: number;
        kills: number;
        deaths: number;
        assists: number;
        win: boolean;
        totalDamageDealtToChampions: number;
        goldEarned: number;
        totalMinionsKilled: number;
        neutralMinionsKilled: number;
        teamPosition: string;
      }[];
    };
  };
}

interface MatchSeries {
  id: string;
  teamAId: string;
  teamBId: string;
  games: SeriesGame[];
}

interface MatchWeek {
  id: string;
  weekNumber: number;
  label?: string;
  series: MatchSeries[];
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseWeekCsv(text: string): { teamAId: string; teamBId: string; games: { gameNumber: number; matchId: string }[] }[] {
  const rows: { teamAId: string; teamBId: string; games: { gameNumber: number; matchId: string }[] }[] = [];
  for (const raw of text.split("\n")) {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 3) continue;
    // Skip header row
    if (parts[0].toLowerCase() === "matchup" || parts[0].toLowerCase() === "team") continue;
    const [teamAId, teamBId, ...matchIds] = parts;
    const games = matchIds
      .filter((id) => id.includes("-"))
      .map((matchId, i) => ({ gameNumber: i + 1, matchId }));
    if (games.length > 0) rows.push({ teamAId, teamBId, games });
  }
  return rows;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getWinner(game: SeriesGame): "blue" | "red" | null {
  if (!game.data) return null;
  const p = game.data.info.participants.find((p) => p.teamId === 100);
  if (!p) return null;
  return p.win ? "blue" : "red";
}

function getTeamParticipants(game: SeriesGame, teamId: 100 | 200) {
  return game.data?.info.participants.filter((p) => p.teamId === teamId) ?? [];
}

// ─── Series Card ──────────────────────────────────────────────────────────────
function SeriesCard({
  series, teams, champMap, ddVersion,
}: {
  series: MatchSeries;
  teams: TournamentTeam[];
  champMap: Record<string, ChampionData>;
  ddVersion: string;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const teamA = teams.find((t) => t.id === series.teamAId);
  const teamB = teams.find((t) => t.id === series.teamBId);

  // Determine series score
  let aWins = 0, bWins = 0;
  for (const g of series.games) {
    if (!g.data) continue;
    const winner = getWinner(g);
    // Try to map blue/red to team A/B using puuid matching
    const blueParticipants = getTeamParticipants(g, 100);
    const aPlayers = new Set(teamA?.roster.map((r) => r.puuid).filter(Boolean));
    const blueIsA = blueParticipants.some((p) => aPlayers.has(p.puuid));
    if (winner === "blue") { blueIsA ? aWins++ : bWins++; }
    else if (winner === "red") { blueIsA ? bWins++ : aWins++; }
  }

  const seriesOver = series.games.some((g) => g.data);
  const aColor = teamA?.isOurTeam ? "#60a5fa" : "#cbd5e1";
  const bColor = teamB?.isOurTeam ? "#60a5fa" : "#cbd5e1";

  return (
    <div style={{ background: "#16213e", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #1e293b" }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: aColor }}>{teamA?.abbreviation ?? series.teamAId}</span>
        {seriesOver && (
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", background: "#0f172a", padding: "2px 10px", borderRadius: 20 }}>
            {aWins} – {bWins}
          </span>
        )}
        <span style={{ fontSize: 14, color: "#94a3b8" }}>vs</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: bColor }}>{teamB?.abbreviation ?? series.teamBId}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "#64748b" }}>
          {series.games.filter((g) => g.fetchedAt).length}/{series.games.length} fetched
        </span>
      </div>

      {/* Game rows */}
      {series.games.map((game) => {
        const winner = getWinner(game);
        const blueTeam = getTeamParticipants(game, 100);
        const redTeam = getTeamParticipants(game, 200);
        const isExpanded = expanded === game.gameNumber;

        return (
          <div key={game.gameNumber}>
            <div
              onClick={() => game.data && setExpanded(isExpanded ? null : game.gameNumber)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                borderBottom: "1px solid #0f172a",
                cursor: game.data ? "pointer" : "default",
                background: isExpanded ? "#1e293b" : "transparent",
              }}
            >
              <span style={{ fontSize: 11, color: "#64748b", width: 50, flexShrink: 0 }}>Game {game.gameNumber}</span>

              {game.data ? (
                <>
                  {/* Blue side champs */}
                  <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                    {blueTeam.slice(0, 5).map((p, i) => (
                      <img key={i} src={champIconUrl(ddVersion, champMap[p.championName]?.image.full ?? `${p.championName}.png`)}
                        alt={p.championName} title={p.championName}
                        width={24} height={24} style={{ borderRadius: 3, opacity: winner === "blue" ? 1 : 0.5 }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: winner === "blue" ? "#4ade80" : "#f87171", fontWeight: 700, minWidth: 20 }}>
                    {winner === "blue" ? "W" : "L"}
                  </span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>vs</span>
                  <span style={{ fontSize: 12, color: winner === "red" ? "#4ade80" : "#f87171", fontWeight: 700, minWidth: 20 }}>
                    {winner === "red" ? "W" : "L"}
                  </span>
                  {/* Red side champs */}
                  <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                    {redTeam.slice(0, 5).map((p, i) => (
                      <img key={i} src={champIconUrl(ddVersion, champMap[p.championName]?.image.full ?? `${p.championName}.png`)}
                        alt={p.championName} title={p.championName}
                        width={24} height={24} style={{ borderRadius: 3, opacity: winner === "red" ? 1 : 0.5 }} />
                    ))}
                  </div>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    {fmtDuration(game.data.info.gameDuration)}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "#475569" }}>
                  {game.matchId.slice(0, 28)}…
                </span>
              )}
            </div>

            {/* Expanded box score */}
            {isExpanded && game.data && (
              <div style={{ background: "#0f172a", padding: "12px 16px", borderBottom: "1px solid #1e293b" }}>
                <div style={{ display: "flex", gap: 24 }}>
                  {[{ participants: blueTeam, label: teamA?.abbreviation ?? "Blue", won: winner === "blue", color: "#60a5fa" },
                    { participants: redTeam, label: teamB?.abbreviation ?? "Red", won: winner === "red", color: "#f87171" }].map(({ participants, label, won, color }) => (
                    <div key={label} style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        {label}
                        {won && <span style={{ background: "#166534", color: "#4ade80", padding: "1px 7px", borderRadius: 10, fontSize: 10 }}>WIN</span>}
                      </div>
                      {participants.map((p, i) => {
                        const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
                        const dmgK = Math.round(p.totalDamageDealtToChampions / 1000);
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <img src={champIconUrl(ddVersion, champMap[p.championName]?.image.full ?? `${p.championName}.png`)}
                              alt={p.championName} width={20} height={20} style={{ borderRadius: 2 }} />
                            <span style={{ fontSize: 12, color: "#cbd5e1", width: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.summonerName || p.championName}
                            </span>
                            <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>
                              {p.kills}/{p.deaths}/{p.assists}
                            </span>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{cs} CS</span>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{dmgK}k dmg</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Add Week Modal ───────────────────────────────────────────────────────────
function AddWeekModal({ onClose, onAdd }: { onClose: () => void; onAdd: (week: any) => void }) {
  const [weekNumber, setWeekNumber] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    const num = parseInt(weekNumber, 10);
    if (!num || num < 1) { setError("Enter a valid week number"); return; }
    const series = parseWeekCsv(csv);
    if (series.length === 0) { setError("No valid series found in CSV. Format: TeamA TeamB MatchId1 MatchId2 ..."); return; }
    onAdd({ weekNumber: num, series });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={onClose}>
      <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 12, padding: 24, width: 560 }}
        onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", color: "#e2e8f0" }}>Add Week</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#60a5fa", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Week Number</label>
          <input value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} placeholder="2"
            style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #2d2d4e", background: "#0f172a", color: "#e2e8f0", fontSize: 13, boxSizing: "border-box", outline: "none" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#60a5fa", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Match IDs (paste CSV)</label>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
            One series per line: <code style={{ color: "#cbd5e1" }}>TeamA TeamB MatchId1 MatchId2 MatchId3</code>
          </div>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} placeholder={"POW T4DJ NA05102-abc... NA05102-def...\nGRY GSU NA05102-..."}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #2d2d4e", background: "#0f172a", color: "#e2e8f0", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
        </div>
        {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} style={{ flex: 1 }}>Add Week</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MatchHistory() {
  const [weekSummaries, setWeekSummaries] = useState<WeekSummary[]>([]);
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState<MatchWeek | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [ddVersion, setDdVersion] = useState("14.24.1");
  const [fetching, setFetching] = useState(false);
  const [showAddWeek, setShowAddWeek] = useState(false);

  const champMap = useMemo(() => {
    const m: Record<string, ChampionData> = {};
    for (const c of champions) { m[c.id] = c; m[c.name] = c; }
    return m;
  }, [champions]);

  useEffect(() => {
    Promise.all([getTournamentTeams(), getChampions(), getDDVersion()]).then(
      ([ts, cs, { version }]) => { setTeams(ts); setChampions(cs); setDdVersion(version); }
    );
    loadWeeks();
  }, []);

  async function loadWeeks() {
    const summaries = await getMatchWeeks();
    setWeekSummaries(summaries);
    if (summaries.length > 0 && !activeWeekId) {
      const first = summaries[0].id;
      setActiveWeekId(first);
      loadWeek(first);
    }
  }

  async function loadWeek(weekId: string) {
    setActiveWeekId(weekId);
    const week = await getMatchWeek(weekId);
    setActiveWeek(week);
  }

  async function handleFetch() {
    if (!activeWeekId) return;
    setFetching(true);
    try {
      const { week } = await fetchWeekData(activeWeekId);
      setActiveWeek(week);
      await loadWeeks();
    } finally {
      setFetching(false);
    }
  }

  async function handleAddWeek(payload: any) {
    await createMatchWeek(payload);
    setShowAddWeek(false);
    await loadWeeks();
  }

  const activeSummary = weekSummaries.find((w) => w.id === activeWeekId);
  const allFetched = activeSummary && activeSummary.fetchedCount === activeSummary.totalGames;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Match History</h2>
        <div style={{ flex: 1 }} />
        {activeWeekId && !allFetched && (
          <button className="btn-primary" onClick={handleFetch} disabled={fetching} style={{ fontSize: 13 }}>
            {fetching ? "Fetching…" : "Fetch Week Data"}
          </button>
        )}
        <button className="btn-secondary" onClick={() => setShowAddWeek(true)} style={{ fontSize: 13 }}>
          + Add Week
        </button>
      </div>

      {/* Week tabs */}
      {weekSummaries.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1e293b", paddingBottom: 0 }}>
          {weekSummaries.map((w) => (
            <button key={w.id} onClick={() => loadWeek(w.id)}
              style={{
                padding: "8px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 14,
                color: activeWeekId === w.id ? "#3b82f6" : "#94a3b8",
                borderBottom: activeWeekId === w.id ? "2px solid #3b82f6" : "2px solid transparent",
                fontWeight: activeWeekId === w.id ? 600 : 400,
                marginBottom: -1,
              }}>
              Week {w.weekNumber}
              {w.fetchedCount < w.totalGames && (
                <span style={{ marginLeft: 6, fontSize: 10, color: "#64748b" }}>
                  {w.fetchedCount}/{w.totalGames}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Series grid */}
      {activeWeek ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 16 }}>
          {activeWeek.series.map((series) => (
            <SeriesCard key={series.id} series={series} teams={teams} champMap={champMap} ddVersion={ddVersion} />
          ))}
        </div>
      ) : weekSummaries.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
          No match data yet. Click "+ Add Week" to get started.
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>Loading…</div>
      )}

      {showAddWeek && (
        <AddWeekModal onClose={() => setShowAddWeek(false)} onAdd={handleAddWeek} />
      )}
    </div>
  );
}
