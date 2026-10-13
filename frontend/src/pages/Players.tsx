import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPlayers,
  addPlayer,
  deletePlayer,
  getTournamentTeams,
  getDDVersion,
} from "../lib/api";
import { PlayerProfile, TournamentTeam } from "../types";
import OpggMultiLink from "../components/OpggMultiLink";
import { profileIconUrl } from "../lib/ddragon";
import RankBadge from "../components/RankBadge";

const DIV_COLOR: Record<string, string> = {
  "Ho-Oh": "#f59e0b",
  "Lugia": "#60a5fa",
};

export default function Players() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ddVersion, setDdVersion] = useState("14.24.1");

  async function load() {
    const [ps, ts] = await Promise.all([getPlayers(), getTournamentTeams()]);
    setPlayers(ps);
    setTeams(ts);
  }

  useEffect(() => {
    load();
    getDDVersion().then(({ version }) => setDdVersion(version));
  }, []);

  async function handleAdd() {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      await addPlayer(input.trim());
      setInput("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add player");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(puuid: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Remove this player from all records?")) return;
    await deletePlayer(puuid);
    await load();
  }

  // Build a map of puuid → profile for quick lookup
  const profileMap = new Map(players.map((p) => [p.puuid, p]));

  // Track which puuids are accounted for in tournament teams
  const accountedPuuids = new Set<string>();
  for (const team of teams) {
    for (const entry of team.roster) {
      if (entry.puuid) accountedPuuids.add(entry.puuid);
    }
  }
  const ungrouped = players.filter((p) => !accountedPuuids.has(p.puuid));

  // Group teams by division
  const hoOh = teams.filter((t) => t.division === "Ho-Oh");
  const lugia = teams.filter((t) => t.division === "Lugia");

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Players</h2>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Add player (Name#TAG)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#1a1a2e", color: "#fff", width: 220 }}
          />
          <button onClick={handleAdd} disabled={loading} className="btn-primary">
            {loading ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
      {error && <p style={{ color: "#f87171", marginTop: -12 }}>{error}</p>}

      {teams.length > 0 ? (
        <div style={{ display: "flex", gap: 32 }}>
          {[{ label: "Ho-Oh Division", teams: hoOh }, { label: "Lugia Division", teams: lugia }].map(({ label, teams: divTeams }) => (
            <div key={label} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: DIV_COLOR[label.split(" ")[0]], textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
                {label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {divTeams.map((team) => (
                  <TeamSection
                    key={team.id}
                    team={team}
                    profileMap={profileMap}
                    ddVersion={ddVersion}
                    onNavigate={(puuid) => navigate(`/players/${puuid}`)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {players.map((p) => (
            <PlayerRow key={p.puuid} profile={p} ddVersion={ddVersion}
              onClick={() => navigate(`/players/${p.puuid}`)}
              onDelete={handleDelete} />
          ))}
          {players.length === 0 && <p style={{ color: "#cbd5e1" }}>No players yet.</p>}
        </div>
      )}

      {ungrouped.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
            Other
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ungrouped.map((p) => (
              <PlayerRow key={p.puuid} profile={p} ddVersion={ddVersion}
                onClick={() => navigate(`/players/${p.puuid}`)}
                onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamSection({
  team, profileMap, ddVersion, onNavigate, onDelete,
}: {
  team: TournamentTeam;
  profileMap: Map<string, PlayerProfile>;
  ddVersion: string;
  onNavigate: (puuid: string) => void;
  onDelete: (puuid: string, e: React.MouseEvent) => void;
}) {
  const starters = team.roster.filter((r) => r.position !== "SUB");
  const subs = team.roster.filter((r) => r.position === "SUB");
  const imported = team.roster.filter((r) => r.puuid && profileMap.has(r.puuid)).length;

  return (
    <div style={{ background: "#16213e", border: `1px solid ${team.isOurTeam ? "#3b82f6" : "#2d2d4e"}`, borderRadius: 10, overflow: "hidden" }}>
      {/* Team header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #1e293b", background: team.isOurTeam ? "rgba(59,130,246,0.08)" : "transparent" }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{team.name}</span>
          {team.isOurTeam && <span style={{ marginLeft: 8, fontSize: 10, background: "#1d4ed8", padding: "1px 7px", borderRadius: 10 }}>Us</span>}
          <span style={{ marginLeft: 8, fontSize: 11, color: "#8899aa" }}>{team.abbreviation}</span>
          <span style={{ marginLeft: 8 }}>
            <OpggMultiLink roster={team.roster} />
          </span>
        </div>
        <span style={{ fontSize: 11, color: imported === team.roster.length ? "#4ade80" : "#cbd5e1" }}>
          {imported}/{team.roster.length}
        </span>
      </div>

      {/* Roster */}
      <div>
        {starters.map((entry) => {
          const profile = entry.puuid ? profileMap.get(entry.puuid) : null;
          return (
            <RosterRow key={entry.riotId} riotId={entry.riotId} position={entry.position}
              profile={profile ?? null} ddVersion={ddVersion}
              onClick={profile ? () => onNavigate(entry.puuid!) : undefined}
              onDelete={profile ? (e) => onDelete(entry.puuid!, e) : undefined} />
          );
        })}
        {subs.map((entry) => {
          const profile = entry.puuid ? profileMap.get(entry.puuid) : null;
          return (
            <RosterRow key={entry.riotId} riotId={entry.riotId} position={entry.position}
              profile={profile ?? null} ddVersion={ddVersion} isSub
              onClick={profile ? () => onNavigate(entry.puuid!) : undefined}
              onDelete={profile ? (e) => onDelete(entry.puuid!, e) : undefined} />
          );
        })}
      </div>
    </div>
  );
}

const POS_COLOR: Record<string, string> = {
  TOP: "#f59e0b", JUNGLE: "#22c55e", MID: "#3b82f6",
  BOT: "#a855f7", SUPPORT: "#ec4899", SUB: "#8899aa",
};

function RosterRow({ riotId, position, profile, ddVersion, isSub, onClick, onDelete }: {
  riotId: string;
  position: string;
  profile: PlayerProfile | null;
  ddVersion: string;
  isSub?: boolean;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 14px", borderBottom: "1px solid #1e293b",
        cursor: onClick ? "pointer" : "default",
        opacity: isSub ? 0.7 : 1,
        background: hovered ? "rgba(59,130,246,0.08)" : "transparent",
        transition: "background 0.12s",
      }}
    >
      {/* Position badge */}
      <div style={{ width: 36, fontSize: 10, fontWeight: 700, color: POS_COLOR[position] ?? "#8899aa", flexShrink: 0, textAlign: "center" }}>
        {position}
      </div>

      {/* Profile icon */}
      {profile ? (
        <img src={profileIconUrl(ddVersion, profile.profileIconId)} alt="" width={32} height={32}
          style={{ borderRadius: "50%", flexShrink: 0 }} />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1e293b", flexShrink: 0 }} />
      )}

      {/* Name + rank */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {riotId}
        </div>
        {profile && (
          <div style={{ fontSize: 11, color: "#cbd5e1" }}>
            <RankBadge entry={profile.ranked.soloQueue} size="sm" />
            {profile.matchHistory?.length ? ` · ${profile.matchHistory.length}G` : ""}
          </div>
        )}
        {!profile && <div style={{ fontSize: 11, color: "#cbd5e1" }}>Not imported</div>}
      </div>

      {/* Delete */}
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(e); }}
          className="btn-danger" style={{ fontSize: 11, padding: "2px 8px", opacity: 0, flexShrink: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}>
          ✕
        </button>
      )}
    </div>
  );
}

function PlayerRow({ profile, ddVersion, onClick, onDelete }: {
  profile: PlayerProfile;
  ddVersion: string;
  onClick: () => void;
  onDelete: (puuid: string, e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
        borderRadius: 8, cursor: "pointer", border: "1px solid #2d2d4e",
        background: hovered ? "#1e3a5f" : "#16213e", transition: "background 0.12s",
      }}>
      <img src={profileIconUrl(ddVersion, profile.profileIconId)} alt="" width={36} height={36} style={{ borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{profile.riotId}</div>
        <div style={{ fontSize: 12, color: "#cbd5e1" }}>
          <RankBadge entry={profile.ranked.soloQueue} size="sm" /> · Lv {profile.summonerLevel}
          {profile.matchHistory?.length ? ` · ${profile.matchHistory.length}G` : ""}
        </div>
      </div>
      <button onClick={(e) => onDelete(profile.puuid, e)} className="btn-danger" style={{ fontSize: 11, padding: "2px 8px" }}>✕</button>
    </div>
  );
}
