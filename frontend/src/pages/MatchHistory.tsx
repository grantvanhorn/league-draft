import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMatchWeeks, getMatchWeek, createMatchWeek, fetchWeekData,
  WeekSummary, getTournamentTeams,
} from "../lib/api";
import { TournamentTeam } from "../types";

interface SeriesSubstitute {
  riotIdGameName: string;
  replacingRiotId: string;
  teamId: string;
}

interface SeriesGame {
  gameNumber: number;
  matchId: string;
  fetchedAt?: string;
  data?: { info: { participants: { puuid: string; riotIdGameName: string; teamId: number; win: boolean }[] } };
}

interface MatchSeries {
  id: string;
  teamAId: string;
  teamBId: string;
  games: SeriesGame[];
  substitutes?: SeriesSubstitute[];
}

interface MatchWeek {
  id: string;
  weekNumber: number;
  label?: string;
  series: MatchSeries[];
}

function parseWeekCsv(text: string) {
  const rows: { teamAId: string; teamBId: string; games: { gameNumber: number; matchId: string }[] }[] = [];
  for (const raw of text.split("\n")) {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 3) continue;
    if (parts[0].toLowerCase() === "matchup" || parts[0].toLowerCase() === "team") continue;
    const [teamAId, teamBId, ...matchIds] = parts;
    const games = matchIds.filter((id) => id.includes("_") || id.includes("-")).map((matchId, i) => ({ gameNumber: i + 1, matchId }));
    if (games.length > 0) rows.push({ teamAId, teamBId, games });
  }
  return rows;
}

// ─── Series row ───────────────────────────────────────────────────────────────
function SeriesRow({ series, teams }: { series: MatchSeries; teams: TournamentTeam[] }) {
  const navigate = useNavigate();
  const teamA = teams.find((t) => t.id === series.teamAId);
  const teamB = teams.find((t) => t.id === series.teamBId);

  const aPlayers = useMemo(() => new Set(teamA?.roster.map((r) => r.puuid).filter(Boolean) as string[]), [teamA]);
  const aSubNames = useMemo(() => new Set(
    series.substitutes?.filter((s) => s.teamId === series.teamAId).map((s) => s.riotIdGameName) ?? []
  ), [series.substitutes, series.teamAId]);

  let aWins = 0, bWins = 0;
  for (const g of series.games) {
    if (!g.data) continue;
    const blue = g.data.info.participants.filter((p) => p.teamId === 100);
    const blueWon = g.data.info.participants.find((p) => p.teamId === 100)?.win ?? false;
    const aBlue = blue.some((p) => aPlayers.has(p.puuid) || aSubNames.has(p.riotIdGameName));
    if (blueWon) { aBlue ? aWins++ : bWins++; } else { aBlue ? bWins++ : aWins++; }
  }

  const hasData = series.games.some((g) => g.data);
  const hasSubs = (series.substitutes?.length ?? 0) > 0;
  const fetchCount = series.games.filter((g) => g.fetchedAt).length;
  const isOurGame = teamA?.isOurTeam || teamB?.isOurTeam;
  const aColor = teamA?.isOurTeam ? "#60a5fa" : "#e2e8f0";
  const bColor = teamB?.isOurTeam ? "#60a5fa" : "#e2e8f0";

  return (
    <div
      onClick={() => navigate(`/matches/${series.id}`)}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "14px 20px",
        background: "#16213e",
        border: isOurGame ? "1px solid #1e3a5f" : "1px solid #1e293b",
        borderRadius: 8,
        cursor: "pointer",
      }}
    >
      {/* Team A */}
      <div style={{ width: 180, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: aColor }}>{teamA?.name ?? series.teamAId}</span>
        {teamA && <span style={{ fontSize: 11, color: "#94a3b8" }}>{teamA.abbreviation} · {teamA.division}</span>}
      </div>

      {/* Score or status */}
      <div style={{ width: 80, textAlign: "center" }}>
        {hasData ? (
          <span style={{ fontSize: 20, fontWeight: 800, color: "#e2e8f0", letterSpacing: 2 }}>
            {aWins}<span style={{ color: "#94a3b8", margin: "0 4px" }}>–</span>{bWins}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {fetchCount}/{series.games.length} fetched
          </span>
        )}
      </div>

      {/* Team B */}
      <div style={{ width: 180, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: bColor }}>{teamB?.name ?? series.teamBId}</span>
        {teamB && <span style={{ fontSize: 11, color: "#94a3b8" }}>{teamB.abbreviation} · {teamB.division}</span>}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {isOurGame && (
          <span style={{ fontSize: 11, color: "#3b82f6", background: "#1e3a5f", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
            our game
          </span>
        )}
        {hasSubs && (
          <span style={{ fontSize: 11, color: "#f59e0b", background: "#2d1f06", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
            subs
          </span>
        )}
        <span style={{ fontSize: 12, color: "#94a3b8" }}>→</span>
      </div>
    </div>
  );
}

// ─── Add Week Modal ───────────────────────────────────────────────────────────
function AddWeekModal({ onClose, onAdd }: { onClose: () => void; onAdd: (w: any) => void }) {
  const [weekNumber, setWeekNumber] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    const num = parseInt(weekNumber, 10);
    if (!num || num < 1) { setError("Enter a valid week number"); return; }
    const series = parseWeekCsv(csv);
    if (series.length === 0) { setError("No valid series found. Format: TeamA TeamB MatchId1 MatchId2 ..."); return; }
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
          <input value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} placeholder="1"
            style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #2d2d4e", background: "#0f172a", color: "#e2e8f0", fontSize: 13, boxSizing: "border-box", outline: "none" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#60a5fa", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Match IDs</label>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
            One matchup per line: <code style={{ color: "#cbd5e1" }}>TeamA TeamB MatchId1 MatchId2 MatchId3</code>
          </div>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8}
            placeholder={"UNC TBM NA1_5659229352 NA1_5659275778\nCT HYG NA1_..."}
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
  const [fetching, setFetching] = useState(false);
  const [showAddWeek, setShowAddWeek] = useState(false);

  useEffect(() => {
    getTournamentTeams().then(setTeams);
    loadWeeks();
  }, []);

  async function loadWeeks() {
    const summaries = await getMatchWeeks();
    setWeekSummaries(summaries);
    if (summaries.length > 0) {
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
    } finally { setFetching(false); }
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Matches</h2>
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
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1e293b" }}>
          {weekSummaries.map((w) => (
            <button key={w.id} onClick={() => loadWeek(w.id)} style={{
              padding: "8px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 14,
              color: activeWeekId === w.id ? "#3b82f6" : "#94a3b8",
              borderBottom: activeWeekId === w.id ? "2px solid #3b82f6" : "2px solid transparent",
              fontWeight: activeWeekId === w.id ? 600 : 400, marginBottom: -1,
            }}>
              Week {w.weekNumber}
              {w.fetchedCount < w.totalGames && (
                <span style={{ marginLeft: 6, fontSize: 10, color: "#94a3b8" }}>{w.fetchedCount}/{w.totalGames}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Series list */}
      {activeWeek ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeWeek.series.map((s) => (
            <SeriesRow key={s.id} series={s} teams={teams} />
          ))}
        </div>
      ) : weekSummaries.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          No match data yet. Click "+ Add Week" to get started.
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading…</div>
      )}

      {showAddWeek && <AddWeekModal onClose={() => setShowAddWeek(false)} onAdd={handleAddWeek} />}
    </div>
  );
}
