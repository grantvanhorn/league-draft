import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getTournamentTeams } from "../lib/api";
import { TournamentTeam } from "../types";

const POS_COLOR: Record<string, string> = {
  TOP: "#f59e0b", JUNGLE: "#22c55e", MID: "#3b82f6",
  BOT: "#a855f7", SUPPORT: "#ec4899", SUB: "#8899aa",
};

export default function Teams() {
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getTournamentTeams().then((t) => { setTeams(t); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: "#cbd5e1", padding: 40, textAlign: "center" }}>Loading…</div>;

  if (teams.length === 0) {
    return (
      <div style={{ color: "#8899aa", padding: 60, textAlign: "center" }}>
        No tournament teams yet. Go to the Tournament tab to seed and import.
      </div>
    );
  }

  const hoOhTeams = teams.filter((t) => t.division === "Ho-Oh");
  const lugiaTeams = teams.filter((t) => t.division === "Lugia");

  function renderDivision(label: string, divTeams: TournamentTeam[]) {
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          {label}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {divTeams.map((team) => {
            const starters = team.roster.filter((r) => r.position !== "SUB");
            const imported = team.roster.filter((r) => r.puuid !== null).length;
            return (
              <div
                key={team.id}
                onClick={() => navigate(`/teams/${team.id}`)}
                style={{
                  background: team.isOurTeam ? "#1e3a5f" : "#16213e",
                  border: `1px solid ${team.isOurTeam ? "#3b82f6" : "#2d2d4e"}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = team.isOurTeam ? "#3b82f6" : "#2d2d4e")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {team.name}
                      {team.isOurTeam && (
                        <span style={{ marginLeft: 8, fontSize: 11, background: "#1d4ed8", padding: "2px 7px", borderRadius: 10 }}>Us</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#8899aa" }}>Captain: {team.captain}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#8899aa" }}>{team.abbreviation}</div>
                </div>

                <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                  {starters.map((entry) => (
                    <div
                      key={entry.riotId}
                      title={`${entry.position}: ${entry.riotId}`}
                      style={{
                        flex: 1,
                        height: 5,
                        borderRadius: 3,
                        background: POS_COLOR[entry.position] ?? "#8899aa",
                        opacity: entry.puuid ? 1 : 0.25,
                      }}
                    />
                  ))}
                </div>

                <div style={{ fontSize: 12, color: imported === team.roster.length ? "#4ade80" : "#8899aa" }}>
                  {imported}/{team.roster.length} imported
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 24px" }}>Teams</h2>
      {renderDivision("Ho-Oh Division", hoOhTeams)}
      {renderDivision("Lugia Division", lugiaTeams)}
    </div>
  );
}
