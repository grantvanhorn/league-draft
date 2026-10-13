import { useState, useEffect, useRef, createContext, useContext } from "react";
import {
  getTournamentTeams,
  seedTournament,
  startImport,
  retryImport,
  refreshTournament,
  deepImportTournament,
  getImportStatus,
  getDDVersion,
} from "../lib/api";
import { TournamentTeam, ImportStatus, TournamentRosterEntry } from "../types";
import { profileIconUrl } from "../lib/ddragon";
import RankBadge from "../components/RankBadge";
import OpggMultiLink from "../components/OpggMultiLink";

const POS_COLOR: Record<string, string> = {
  TOP: "#f59e0b",
  JUNGLE: "#22c55e",
  MID: "#3b82f6",
  BOT: "#a855f7",
  SUPPORT: "#ec4899",
  SUB: "#cbd5e1",
};

const DDVersionCtx = createContext("14.24.1");

export default function Tournament() {
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TournamentTeam | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [ddVersion, setDdVersion] = useState("14.24.1");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const t = await getTournamentTeams();
    setTeams(t);
    if (selectedTeam) {
      const fresh = t.find((x) => x.id === selectedTeam.id);
      if (fresh) setSelectedTeam(fresh);
    }
  }

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const status = await getImportStatus();
      setImportStatus(status);
      if (!status.running) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        await load();
      }
    }, 2000);
  }

  useEffect(() => {
    load();
    getDDVersion().then(({ version }) => setDdVersion(version));
    getImportStatus().then((status) => {
      setImportStatus(status);
      if (status.running) startPolling();
    });
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  async function handleSeed() {
    setSeeding(true);
    await seedTournament();
    await load();
    setSeeding(false);
  }

  async function handleImport() {
    await startImport();
    setImportStatus(await getImportStatus());
    startPolling();
  }

  async function handleRetry() {
    await retryImport();
    setImportStatus(await getImportStatus());
    startPolling();
  }

  async function handleRefresh() {
    await refreshTournament();
    setImportStatus(await getImportStatus());
    startPolling();
  }

  async function handleDeepImport() {
    if (!confirm("This will re-fetch full match history (~500 games) for all 73 players. It will take several hours. Continue?")) return;
    await deepImportTournament();
    setImportStatus(await getImportStatus());
    startPolling();
  }

  const hoOhTeams = teams.filter((t) => t.division === "Ho-Oh");
  const lugiaTeams = teams.filter((t) => t.division === "Lugia");
  const totalRoster = teams.reduce((n, t) => n + t.roster.length, 0);
  const imported = teams.reduce(
    (n, t) => n + t.roster.filter((r) => r.puuid !== null).length,
    0
  );

  return (
    <DDVersionCtx.Provider value={ddVersion}>
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Tournament Teams</h2>
        <div style={{ flex: 1 }} />
        {teams.length === 0 ? (
          <button onClick={handleSeed} disabled={seeding} className="btn-primary">
            {seeding ? "Seeding…" : "Seed Teams"}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleImport}
              disabled={importStatus?.running}
              className="btn-primary"
            >
              {importStatus?.running ? "Importing…" : "Import All Players"}
            </button>
            {imported < totalRoster && !importStatus?.running && (
              <button onClick={handleRetry} className="btn-secondary">
                Retry Missing ({totalRoster - imported})
              </button>
            )}
            {imported > 0 && !importStatus?.running && (
              <button onClick={handleRefresh} className="btn-secondary">
                Refresh Data
              </button>
            )}
            {imported > 0 && !importStatus?.running && (
              <button onClick={handleDeepImport} className="btn-secondary" title="Force-rebuild all profiles with full match history">
                Full History Import
              </button>
            )}
          </div>
        )}
      </div>

      {importStatus && (importStatus.running || importStatus.finishedAt) && (
        <ImportProgress status={importStatus} />
      )}

      {teams.length > 0 && (
        <div style={{ marginBottom: 12, color: "#cbd5e1", fontSize: 13 }}>
          {imported}/{totalRoster} players imported
        </div>
      )}

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flex: 1 }}>
          {teams.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#8899aa" }}>
              <p>No tournament data yet.</p>
              <p>Click "Seed Teams" to load the tournament structure, then "Import All Players" to fetch Riot data.</p>
            </div>
          ) : (
            <>
              <Division
                label="Team Ho-Oh"
                teams={hoOhTeams}
                selected={selectedTeam}
                onSelect={setSelectedTeam}
              />
              <Division
                label="Team Lugia"
                teams={lugiaTeams}
                selected={selectedTeam}
                onSelect={setSelectedTeam}
              />
            </>
          )}
        </div>

        {selectedTeam && (
          <TeamDetail team={selectedTeam} />
        )}
      </div>
    </div>
    </DDVersionCtx.Provider>
  );
}

function Division({
  label,
  teams,
  selected,
  onSelect,
}: {
  label: string;
  teams: TournamentTeam[];
  selected: TournamentTeam | null;
  onSelect: (t: TournamentTeam) => void;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            isSelected={selected?.id === team.id}
            onClick={() => onSelect(team)}
          />
        ))}
      </div>
    </div>
  );
}

function TeamCard({
  team,
  isSelected,
  onClick,
}: {
  team: TournamentTeam;
  isSelected: boolean;
  onClick: () => void;
}) {
  const starters = team.roster.filter((r) => r.position !== "SUB");
  const imported = team.roster.filter((r) => r.puuid !== null).length;

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? "#1e3a5f" : "#16213e",
        border: `1px solid ${team.isOurTeam ? "#3b82f6" : isSelected ? "#3b82f6" : "#2d2d4e"}`,
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {team.name}
            {team.isOurTeam && (
              <span style={{ marginLeft: 8, fontSize: 11, background: "#1d4ed8", padding: "1px 7px", borderRadius: 10 }}>Us</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#cbd5e1" }}>{team.abbreviation}</div>
        </div>
        <OpggMultiLink roster={team.roster} />
        <div style={{ fontSize: 12, color: imported === team.roster.length ? "#4ade80" : "#cbd5e1" }}>
          {imported}/{team.roster.length}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {starters.map((entry) => (
          <RosterSlot key={entry.riotId} entry={entry} size={32} />
        ))}
      </div>
    </div>
  );
}

function RosterSlot({
  entry,
  size,
}: {
  entry: TournamentRosterEntry;
  size: number;
}) {
  const ddVersion = useContext(DDVersionCtx);
  const pos = entry.position as string;
  return (
    <div
      title={`${pos}: ${entry.riotId}`}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        overflow: "hidden",
        border: `1px solid ${POS_COLOR[pos] ?? "#8899aa"}33`,
        position: "relative",
        background: "#0f172a",
        flexShrink: 0,
      }}
    >
      {entry.profile ? (
        <img
          src={profileIconUrl(ddVersion, entry.profile.profileIconId)}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: POS_COLOR[pos] ?? "#8899aa" }}>
          {pos.slice(0, 3)}
        </div>
      )}
    </div>
  );
}

function TeamDetail({ team }: { team: TournamentTeam }) {
  const starters = team.roster.filter((r) => r.position !== "SUB");
  const subs = team.roster.filter((r) => r.position === "SUB");

  return (
    <div style={{ width: 380, background: "#16213e", borderRadius: 12, padding: 20, border: "1px solid #2d2d4e", alignSelf: "flex-start" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>{team.name}</h3>
          <OpggMultiLink roster={team.roster} />
        </div>
        <div style={{ color: "#cbd5e1", fontSize: 13 }}>
          {team.division} Division · {team.abbreviation}
        </div>
        <div style={{ color: "#8899aa", fontSize: 12 }}>Captain: {team.captain}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Starters</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {starters.map((entry) => (
            <PlayerRow key={entry.riotId} entry={entry} />
          ))}
        </div>
      </div>

      {subs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Subs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {subs.map((entry) => (
              <PlayerRow key={entry.riotId} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ entry }: { entry: TournamentRosterEntry }) {
  const ddVersion = useContext(DDVersionCtx);
  const pos = entry.position as string;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: "#0f172a", borderRadius: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: POS_COLOR[pos] ?? "#8899aa", flexShrink: 0 }} />
      {entry.profile ? (
        <img
          src={profileIconUrl(ddVersion, entry.profile.profileIconId)}
          alt=""
          width={32}
          height={32}
          style={{ borderRadius: "50%", flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1e293b", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.riotId}
        </div>
        <div style={{ fontSize: 11, color: "#cbd5e1" }}>
          {pos} · Tier {entry.tierRank}
          {entry.profile && <>{" · "}<RankBadge entry={entry.profile.ranked.soloQueue} size="sm" /></>}
          {entry.profile && (
            <span style={{ color: "#cbd5e1", marginLeft: 6 }}>
              updated {new Date(entry.profile.lastUpdated).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportProgress({ status }: { status: ImportStatus }) {
  const pct = status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0;

  return (
    <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>
          {status.running ? "Importing players…" : "Import complete"}
        </span>
        <span style={{ color: "#cbd5e1" }}>
          {status.completed}/{status.total}
        </span>
      </div>

      <div style={{ height: 8, background: "#1e293b", borderRadius: 4, marginBottom: 8 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: status.running ? "#3b82f6" : "#4ade80",
            borderRadius: 4,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {status.current && (
        <div style={{ fontSize: 12, color: "#cbd5e1" }}>
          Processing: <span style={{ color: "#e2e8f0" }}>{status.current}</span>
        </div>
      )}

      {status.failed.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: "#f87171", marginBottom: 4 }}>
            {status.failed.length} failed:
          </div>
          {status.failed.map((f) => (
            <div key={f.riotId} style={{ fontSize: 11, color: "#f87171" }}>
              {f.riotId} — {f.error}
            </div>
          ))}
        </div>
      )}

      {!status.running && status.finishedAt && (
        <div style={{ fontSize: 12, color: "#4ade80", marginTop: 6 }}>
          Finished at {new Date(status.finishedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
