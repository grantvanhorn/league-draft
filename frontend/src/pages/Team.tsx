import { useState, useEffect } from "react";
import { getTeam, updateTeamName, removeFromTeam } from "../lib/api";
import { Team } from "../types";
import { profileIconUrl } from "../lib/ddragon";
import RankBadge from "../components/RankBadge";
import { useNavigate } from "react-router-dom";

const DD_VERSION = "14.12.1";
const POSITIONS = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];

export default function TeamPage() {
  const [team, setTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const navigate = useNavigate();

  async function load() {
    const t = await getTeam();
    setTeam(t);
    setNameInput(t.name);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSaveName() {
    if (!nameInput.trim()) return;
    await updateTeamName(nameInput.trim());
    setEditName(false);
    await load();
  }

  async function handleRemove(puuid: string) {
    await removeFromTeam(puuid);
    await load();
  }

  if (!team) return <p>Loading…</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        {editName ? (
          <>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              style={{ fontSize: 24, fontWeight: 700, background: "#1a1a2e", color: "#fff", border: "1px solid #3b82f6", borderRadius: 6, padding: "4px 10px" }}
            />
            <button onClick={handleSaveName} className="btn-primary">Save</button>
            <button onClick={() => setEditName(false)} className="btn-secondary">Cancel</button>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0 }}>{team.name}</h2>
            <button onClick={() => setEditName(true)} className="btn-secondary" style={{ fontSize: 12 }}>Rename</button>
          </>
        )}
      </div>

      {team.players.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#cbd5e1" }}>
          <p>No players on the team yet.</p>
          <button onClick={() => navigate("/players")} className="btn-primary">
            Add Players
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {team.players.map((p) => {
            const winRate = p.ranked.soloQueue
              ? Math.round((p.ranked.soloQueue.wins / (p.ranked.soloQueue.wins + p.ranked.soloQueue.losses)) * 100)
              : null;

            return (
              <div key={p.puuid} style={{ background: "#16213e", borderRadius: 12, padding: 16, border: "1px solid #2d2d4e" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <img
                    src={profileIconUrl(DD_VERSION, p.profileIconId)}
                    alt=""
                    width={48}
                    height={48}
                    style={{ borderRadius: "50%" }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.riotId}</div>
                    <div style={{ fontSize: 12 }}><RankBadge entry={p.ranked.soloQueue} showLP size="sm" /></div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  {p.preferredPositions.map((pos) => (
                    <span key={pos} style={{ background: "#1e3a5f", padding: "2px 10px", borderRadius: 12, fontSize: 12 }}>
                      {pos}
                    </span>
                  ))}
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>Top Champions</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {p.topChampions.slice(0, 5).map((c) => (
                      <div key={c.championId} title={c.championName} style={{ width: 32, height: 32, background: "#0f172a", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, textAlign: "center", overflow: "hidden" }}>
                        {c.championName.slice(0, 3)}
                      </div>
                    ))}
                  </div>
                </div>

                {winRate !== null && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>Win Rate</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: "#1e293b", borderRadius: 3 }}>
                        <div style={{ width: `${winRate}%`, height: "100%", background: winRate >= 50 ? "#4ade80" : "#f87171", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: winRate >= 50 ? "#4ade80" : "#f87171" }}>
                        {winRate}%
                      </span>
                    </div>
                  </div>
                )}

                {POSITIONS.includes(p.preferredPositions[0]) && (
                  <div style={{ fontSize: 12, color: "#8899aa" }}>
                    Roles: {p.preferredPositions.join(" / ") || "Unknown"}
                  </div>
                )}

                {p.notes && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#cbd5e1", fontStyle: "italic" }}>
                    "{p.notes}"
                  </div>
                )}

                <button
                  onClick={() => handleRemove(p.puuid)}
                  className="btn-secondary"
                  style={{ marginTop: 12, fontSize: 12, width: "100%" }}
                >
                  Remove from Team
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
