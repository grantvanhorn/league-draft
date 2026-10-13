import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getDrafts, createDraft, draftAction, deleteDraft, updateDraft, undoDraft,
  getChampions, getDDVersion, getTournamentTeams, getDraft,
} from "../lib/api";
import {
  DraftState, ChampionData, TournamentTeam, TournamentRosterEntry,
  MatchRecord, RankedEntry, RankedSnapshot,
} from "../types";
import { champIconUrl, profileIconUrl, tierColor } from "../lib/ddragon";
import { queueLabel } from "../lib/queues";
import { useQueueFilter } from "../lib/useQueueFilter";
import RankBadge from "../components/RankBadge";
import OpggMultiLink from "../components/OpggMultiLink";
import { FiExternalLink, FiSettings } from "react-icons/fi";
import { GiSwordman, GiShield, GiBroadsword, GiLightningBow, GiMagicSwirl, GiPlainDagger, GiBowArrow, GiCrossedSwords, GiHeartPlus, GiGears, GiFist, GiAnvilImpact } from "react-icons/gi";
import { useDraftSync, PresenceUser } from "../hooks/useDraftSync";
import { getIdentity, setIdentityName, Identity } from "../lib/identity";
import { socket } from "../lib/socket";

function opggPlayerUrl(riotId: string): string {
  const [name, tag] = riotId.split("#");
  return `https://op.gg/lol/summoners/na/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`;
}

function OpggPlayerLink({ riotId }: { riotId: string }) {
  return (
    <a href={opggPlayerUrl(riotId)} target="_blank" rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 10px", borderRadius: 20, background: "#c8102e",
        color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none",
        letterSpacing: 0.3, flexShrink: 0, lineHeight: 1,
      }}>
      op.gg <FiExternalLink size={11} />
    </a>
  );
}

// ─── Role archetypes ──────────────────────────────────────────────────────────

export const ROLE_ARCHETYPES: { id: string; label: string; color: string; desc: string; Icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { id: "role:Engage",       label: "Engage",       color: "#ef4444", desc: "Hard engage / CC",       Icon: GiSwordman },
  { id: "role:Disengage",    label: "Disengage",    color: "#60a5fa", desc: "Peel & disengage",       Icon: GiShield },
  { id: "role:Tank",         label: "Tank",         color: "#6366f1", desc: "Frontline tank",         Icon: GiAnvilImpact },
  { id: "role:Hyper Carry",  label: "Hyper Carry",  color: "#f59e0b", desc: "Late-game carry",        Icon: GiLightningBow },
  { id: "role:Control Mage", label: "Control Mage", color: "#a855f7", desc: "Zone control",           Icon: GiMagicSwirl },
  { id: "role:Assassin",     label: "Assassin",     color: "#ec4899", desc: "Pick / burst",           Icon: GiPlainDagger },
  { id: "role:Poke",         label: "Poke",         color: "#22c55e", desc: "Long range poke",        Icon: GiBowArrow },
  { id: "role:Split Push",   label: "Split Push",   color: "#14b8a6", desc: "Side lane pressure",     Icon: GiCrossedSwords },
  { id: "role:Enchanter",    label: "Enchanter",    color: "#34d399", desc: "Heals & shields",        Icon: GiHeartPlus },
  { id: "role:Utility",      label: "Utility",      color: "#fbbf24", desc: "Team utility",           Icon: GiGears },
  { id: "role:Skirmisher",   label: "Skirmisher",   color: "#f97316", desc: "Duelist / skirmish",     Icon: GiFist },
  { id: "role:Bruiser",      label: "Bruiser",      color: "#84cc16", desc: "Tanky damage dealer",    Icon: GiBroadsword },
];

export function isRolePick(champion: string) { return champion.startsWith("role:"); }
export function roleLabel(champion: string) {
  return ROLE_ARCHETYPES.find((r) => r.id === champion)?.label ?? champion.replace("role:", "");
}
export function roleColor(champion: string) {
  return ROLE_ARCHETYPES.find((r) => r.id === champion)?.color ?? "#cbd5e1";
}

// ─── Draft sequence ───────────────────────────────────────────────────────────
const DRAFT_SEQUENCE = [
  { team: "blue", action: "ban" }, { team: "red", action: "ban" },
  { team: "blue", action: "ban" }, { team: "red", action: "ban" },
  { team: "blue", action: "ban" }, { team: "red", action: "ban" },
  { team: "blue", action: "pick" }, { team: "red", action: "pick" },
  { team: "red", action: "pick" }, { team: "blue", action: "pick" },
  { team: "blue", action: "pick" }, { team: "red", action: "pick" },
  { team: "red", action: "ban" }, { team: "blue", action: "ban" },
  { team: "red", action: "ban" }, { team: "blue", action: "ban" },
  { team: "red", action: "pick" }, { team: "blue", action: "pick" },
  { team: "blue", action: "pick" }, { team: "red", action: "pick" },
] as const;

const POSITION_ORDER = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"] as const;

const POS_COLOR: Record<string, string> = {
  TOP: "#f59e0b", JUNGLE: "#22c55e", MID: "#3b82f6",
  BOT: "#a855f7", SUPPORT: "#ec4899",
};

type PosFilter = "ALL" | "TOP" | "JUNGLE" | "MID" | "BOT" | "SUPPORT";
type View = "list" | "setup" | "draft";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStepIndex(draft: DraftState): number {
  const bansDone = draft.blueBans.length + draft.redBans.length;
  const picksDone = draft.bluePicks.length + draft.redPicks.length;
  let bc = 0, pc = 0;
  for (let i = 0; i < DRAFT_SEQUENCE.length; i++) {
    const s = DRAFT_SEQUENCE[i];
    if (s.action === "ban" && bc === bansDone && pc === picksDone) return i;
    if (s.action === "pick" && bc === bansDone && pc === picksDone) return i;
    if (s.action === "ban") bc++; else pc++;
  }
  return DRAFT_SEQUENCE.length;
}

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

function starters(team: TournamentTeam | null): (TournamentRosterEntry | null)[] {
  if (!team) return Array(5).fill(null);
  const s = team.roster.filter((r) => r.position !== "SUB");
  return POSITION_ORDER.map((pos) => s.find((r) => r.position === pos) ?? null);
}

function masteryColor(level: number): string {
  if (level >= 10) return "#f1c40f";
  if (level >= 7) return "#9b59b6";
  if (level >= 5) return "#3dd9a0";
  return "#cbd5e1";
}

interface ChampStat {
  name: string; games: number; wins: number;
  winrate: number; kda: number;
  avgK: number; avgD: number; avgA: number;
  avgCsMin: number | null; avgDmg: number | null;
}

function computeChampStats(matches: MatchRecord[]): ChampStat[] {
  const map: Record<string, {
    w: number; l: number; k: number; d: number; a: number;
    csMin: number; csMinCount: number; dmg: number; dmgCount: number;
  }> = {};
  for (const m of matches) {
    if (!map[m.championName]) map[m.championName] = { w: 0, l: 0, k: 0, d: 0, a: 0, csMin: 0, csMinCount: 0, dmg: 0, dmgCount: 0 };
    const s = map[m.championName];
    s[m.win ? "w" : "l"]++;
    s.k += m.kda.kills; s.d += m.kda.deaths; s.a += m.kda.assists;
    if (m.csPerMin != null) { s.csMin += m.csPerMin; s.csMinCount++; }
    if (m.damage != null) { s.dmg += m.damage; s.dmgCount++; }
  }
  return Object.entries(map).map(([name, s]) => {
    const games = s.w + s.l;
    return {
      name, games, wins: s.w,
      winrate: Math.round((s.w / games) * 100),
      kda: s.d === 0 ? 99 : (s.k + s.a) / s.d,
      avgK: s.k / games, avgD: s.d / games, avgA: s.a / games,
      avgCsMin: s.csMinCount > 0 ? s.csMin / s.csMinCount : null,
      avgDmg: s.dmgCount > 0 ? s.dmg / s.dmgCount : null,
    };
  }).sort((a, b) => b.games - a.games);
}

function StatBlock({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#cbd5e1" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#8899aa" }}>{sub}</div>}
    </div>
  );
}

interface OverallStats {
  games: number; wins: number; losses: number;
  winrate: number; kda: string;
  avgK: string; avgD: string; avgA: string;
}

function computeOverallStats(matches: MatchRecord[]): OverallStats | null {
  if (!matches.length) return null;
  let wins = 0, k = 0, d = 0, a = 0;
  for (const m of matches) {
    if (m.win) wins++;
    k += m.kda.kills; d += m.kda.deaths; a += m.kda.assists;
  }
  const n = matches.length;
  return {
    games: n, wins, losses: n - wins,
    winrate: Math.round((wins / n) * 100),
    kda: d === 0 ? "∞" : ((k + a) / d).toFixed(2),
    avgK: (k / n).toFixed(1), avgD: (d / n).toFixed(1), avgA: (a / n).toFixed(1),
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DraftPage() {
  const { id: urlDraftId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [view, setView] = useState<View>("list");
  const [drafts, setDrafts] = useState<DraftState[]>([]);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [ddVersion, setDdVersion] = useState("14.24.1");
  const [activeDraft, setActiveDraft] = useState<DraftState | null>(null);
  const [blueTeamId, setBlueTeamId] = useState("");
  const [redTeamId, setRedTeamId] = useState("");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<PosFilter>("ALL");
  const [loading, setLoading] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<TournamentRosterEntry | null>(null);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    Promise.all([getDrafts(), getTournamentTeams(), getChampions(), getDDVersion()]).then(
      ([ds, ts, cs, { version }]) => {
        setDrafts(ds); setTeams(ts); setChampions(cs); setDdVersion(version);
      }
    );
  }, []);

  // Deep-link: load draft from URL param when navigating directly to /draft/:id
  useEffect(() => {
    if (!urlDraftId) return;
    if (activeDraft?.id === urlDraftId) return;
    getDraft(urlDraftId)
      .then((draft) => { setActiveDraft(draft); setView("draft"); })
      .catch(() => navigate("/draft", { replace: true }));
  }, [urlDraftId]);

  useDraftSync(
    view === "draft" ? (activeDraft?.id ?? null) : null,
    (updated) => {
      setActiveDraft(updated);
      setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    },
    (deletedId) => {
      setDrafts((prev) => prev.filter((d) => d.id !== deletedId));
      if (activeDraft?.id === deletedId) {
        setActiveDraft(null);
        setView("list");
        navigate("/draft", { replace: true });
      }
    },
    setPresenceUsers
  );

  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  function handleSaveName() {
    const trimmed = settingsName.trim();
    setIdentityName(trimmed);
    const identity = getIdentity();
    socket.emit("update:identity", { name: trimmed, color: identity.color });
    setSettingsOpen(false);
  }

  const champMap = useMemo(() => {
    const m: Record<string, ChampionData> = {};
    for (const c of champions) { m[c.id] = c; m[c.name] = c; }
    return m;
  }, [champions]);

  async function handleCreate() {
    if (!blueTeamId || !redTeamId) return;
    setLoading(true);
    try {
      const { draft } = await createDraft({ blueTeamId, redTeamId });
      setDrafts((prev) => [draft, ...prev]);
      setActiveDraft(draft);
      setView("draft");
      navigate(`/draft/${draft.id}`);
    } finally { setLoading(false); }
  }

  async function handleUndo() {
    if (!activeDraft) return;
    try {
      const { draft } = await undoDraft(activeDraft.id);
      setActiveDraft(draft);
      setDrafts((prev) => prev.map((d) => (d.id === draft.id ? draft : d)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Undo failed");
    }
  }

  async function handlePick(championName: string) {
    if (!activeDraft) return;
    if (getStepIndex(activeDraft) >= DRAFT_SEQUENCE.length) return;
    try {
      const { draft } = await draftAction(activeDraft.id, championName);
      setActiveDraft(draft);
      setDrafts((prev) => prev.map((d) => (d.id === draft.id ? draft : d)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteDraft(id);
    if (activeDraft?.id === id) {
      setActiveDraft(null);
      setView("list");
      navigate("/draft", { replace: true });
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleUpdateDraft(id: string, patch: { name?: string; description?: string }) {
    const { draft } = await updateDraft(id, patch);
    setDrafts((prev) => prev.map((d) => (d.id === id ? draft : d)));
    if (activeDraft?.id === id) setActiveDraft(draft);
  }

  function openDraft(draft: DraftState) {
    setActiveDraft(draft);
    setExpandedEntry(null);
    setView("draft");
    navigate(`/draft/${draft.id}`);
  }

  const blueTeam = teams.find((t) => t.id === activeDraft?.blueTeamId) ?? null;
  const redTeam = teams.find((t) => t.id === activeDraft?.redTeamId) ?? null;

  // ── List view ───────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <h2 style={{ margin: 0 }}>Drafts</h2>
          <div style={{ flex: 1 }} />
          <button className="btn-primary" onClick={() => { setBlueTeamId(""); setRedTeamId(""); setView("setup"); }}>
            New Draft
          </button>
        </div>
        {drafts.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "#8899aa" }}>
            No drafts yet. Click "New Draft" to start.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {drafts.map((d) => {
            const bt = teams.find((t) => t.id === d.blueTeamId);
            const rt = teams.find((t) => t.id === d.redTeamId);
            return (
              <DraftListRow key={d.id} draft={d} blueTeam={bt} redTeam={rt}
                ddVersion={ddVersion} champMap={champMap}
                onOpen={() => openDraft(d)}
                onDelete={(e) => handleDelete(d.id, e)}
                onUpdate={(patch) => handleUpdateDraft(d.id, patch)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // ── Setup view ──────────────────────────────────────────────────────────────
  if (view === "setup") {
    return (
      <div style={{ maxWidth: 560, margin: "60px auto" }}>
        <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 12, padding: 32 }}>
          <h3 style={{ margin: "0 0 24px" }}>New Draft</h3>
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#60a5fa", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Blue Side</label>
              <TeamSelect teams={teams} value={blueTeamId} exclude={redTeamId} onChange={setBlueTeamId} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#f87171", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Red Side</label>
              <TeamSelect teams={teams} value={redTeamId} exclude={blueTeamId} onChange={setRedTeamId} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-secondary" onClick={() => setView("list")} style={{ flex: 1 }}>Cancel</button>
            <button className="btn-primary" onClick={handleCreate}
              disabled={!blueTeamId || !redTeamId || loading} style={{ flex: 2 }}>
              {loading ? "Creating…" : "Start Draft"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Draft board ─────────────────────────────────────────────────────────────
  if (!activeDraft) return null;

  const stepIdx = getStepIndex(activeDraft);
  const currentStep = stepIdx < DRAFT_SEQUENCE.length ? DRAFT_SEQUENCE[stepIdx] : null;
  const isDone = activeDraft.phase === "complete";

  const allBanned = new Set([...activeDraft.blueBans, ...activeDraft.redBans]);
  const allPicked = new Set([
    ...activeDraft.bluePicks.map((p) => p.champion),
    ...activeDraft.redPicks.map((p) => p.champion),
  ]);
  // Roles can be picked multiple times — only real champions are locked out
  const unavailable = new Set([...allBanned, ...allPicked].filter((c) => !isRolePick(c)));
  const isPicking = currentStep?.action === "pick";

  const filtered = champions.filter(
    (c) => filterByPosition(c, posFilter) && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const blueActiveBan = currentStep?.team === "blue" && currentStep.action === "ban" ? activeDraft.blueBans.length : -1;
  const redActiveBan = currentStep?.team === "red" && currentStep.action === "ban" ? activeDraft.redBans.length : -1;
  const blueActivePick = currentStep?.team === "blue" && currentStep.action === "pick" ? activeDraft.bluePicks.length : -1;
  const redActivePick = currentStep?.team === "red" && currentStep.action === "pick" ? activeDraft.redPicks.length : -1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "calc(100vh - 104px)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button onClick={() => { setView("list"); setExpandedEntry(null); navigate("/draft"); }}
          style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 20, padding: "0 4px" }}>←</button>
        <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 16 }}>{blueTeam?.name ?? activeDraft.blueTeam}</span>
        {blueTeam && <OpggMultiLink roster={blueTeam.roster} />}
        <span style={{ color: "#8899aa" }}>vs</span>
        <span style={{ color: "#f87171", fontWeight: 700, fontSize: 16 }}>{redTeam?.name ?? activeDraft.redTeam}</span>
        {redTeam && <OpggMultiLink roster={redTeam.roster} />}
        <DraftNameEditor draft={activeDraft} onUpdate={(patch) => handleUpdateDraft(activeDraft.id, patch)} />
        <div style={{ flex: 1 }} />
        {/* Presence avatars */}
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {presenceUsers.map((user, i) => (
            <div key={i} title={user.name || "Anonymous"} style={{
              width: 28, height: 28, borderRadius: "50%",
              background: user.color, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff",
              border: "2px solid #0f172a", flexShrink: 0,
            }}>
              {user.name ? user.name[0].toUpperCase() : "?"}
            </div>
          ))}
        </div>
        {/* Settings cog */}
        <button onClick={() => { setSettingsName(getIdentity().name); setSettingsOpen(true); }}
          title="Set your name"
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", borderRadius: 4 }}>
          <FiSettings size={16} />
        </button>
        {(activeDraft.blueBans.length + activeDraft.redBans.length + activeDraft.bluePicks.length + activeDraft.redPicks.length) > 0 && (
          <button onClick={handleUndo} className="btn-secondary" style={{ fontSize: 13 }}>
            ↩ Undo
          </button>
        )}
        {isDone ? (
          <span style={{ background: "#166534", color: "#4ade80", padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>Draft Complete</span>
        ) : currentStep ? (() => {
          const teamAbbr = currentStep.team === "blue" ? (blueTeam?.abbreviation ?? "Blue") : (redTeam?.abbreviation ?? "Red");
          const actionNum = currentStep.action === "ban"
            ? activeDraft.blueBans.length + activeDraft.redBans.length + 1
            : activeDraft.bluePicks.length + activeDraft.redPicks.length + 1;
          return (
            <span style={{ background: currentStep.team === "blue" ? "#1d4ed8" : "#b91c1c", color: "#fff", padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              {teamAbbr} — {currentStep.action === "ban" ? "BAN" : "PICK"} {actionNum}
            </span>
          );
        })() : null}
      </div>

      {/* Main three-column layout */}
      <div style={{ display: "flex", gap: 12, flex: 1, overflow: "hidden" }}>
        <TeamPanel side="blue" team={blueTeam}
          bans={activeDraft.blueBans} picks={activeDraft.bluePicks}
          activeBanSlot={blueActiveBan} activePickSlot={blueActivePick}
          ddVersion={ddVersion} champMap={champMap}
          expandedId={expandedEntry?.riotId ?? null}
          onPlayerClick={(e) => setExpandedEntry(prev => prev?.riotId === e.riotId ? null : e)}
        />

        {/* Center: player profile or champion grid */}
        {expandedEntry ? (
          <PlayerDetailPanel
            key={expandedEntry.riotId}
            entry={expandedEntry}
            ddVersion={ddVersion}
            champMap={champMap}
            onClose={() => setExpandedEntry(null)}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {(["ALL", "TOP", "JUNGLE", "MID", "BOT", "SUPPORT"] as PosFilter[]).map((f) => (
                <button key={f} onClick={() => setPosFilter(f)} style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  border: posFilter === f ? "1px solid #3b82f6" : "1px solid #cbd5e1",
                  background: posFilter === f ? "#1d4ed8" : "#16213e",
                  color: posFilter === f ? "#fff" : "#cbd5e1",
                }}>
                  {f === "BOT" ? "ADC" : f}
                </button>
              ))}
              <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 20, border: "1px solid #cbd5e1", background: "#0f172a", color: "#e2e8f0", fontSize: 13, outline: "none", width: 160 }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 4 }}>
              {/* Role archetype cards — pick phase only */}
              {isPicking && ROLE_ARCHETYPES.filter((r) =>
                !search || r.label.toLowerCase().includes(search.toLowerCase()) || r.desc.toLowerCase().includes(search.toLowerCase())
              ).map((r) => (
                <button key={r.id} onClick={() => !isDone && handlePick(r.id)}
                  disabled={isDone} title={r.desc}
                  style={{ width: 60, padding: 0, border: `1px solid ${r.color}44`, borderRadius: 6, background: "#16213e", cursor: isDone ? "not-allowed" : "pointer", overflow: "hidden", flexShrink: 0 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = r.color; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${r.color}44`; }}
                >
                  <div style={{ width: 60, height: 60, background: `${r.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <r.Icon size={28} color={r.color} />
                  </div>
                  <div style={{ fontSize: 10, color: "#e2e8f0", padding: "3px 2px", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                </button>
              ))}
              {/* Champion cards */}
              {filtered.map((c) => {
                const gone = unavailable.has(c.name);
                const banned = allBanned.has(c.name);
                return (
                  <button key={c.id} onClick={() => !gone && handlePick(c.name)}
                    disabled={gone || isDone} title={c.name}
                    style={{ width: 60, padding: 0, border: "1px solid #1e293b", borderRadius: 6, background: gone ? "#0a0f1a" : "#16213e", cursor: gone || isDone ? "not-allowed" : "pointer", opacity: gone ? 0.35 : 1, overflow: "hidden", flexShrink: 0 }}
                    onMouseEnter={(e) => { if (!gone) (e.currentTarget as HTMLButtonElement).style.borderColor = "#3b82f6"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e293b"; }}
                  >
                    <div style={{ position: "relative" }}>
                      <img src={champIconUrl(ddVersion, c.image.full)} alt={c.name} width={60} height={60} style={{ display: "block", objectFit: "cover" }} />
                      {banned && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
                          <span style={{ color: "#ef4444", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>✕</span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "#e2e8f0", padding: "3px 2px", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <TeamPanel side="red" team={redTeam}
          bans={activeDraft.redBans} picks={activeDraft.redPicks}
          activeBanSlot={redActiveBan} activePickSlot={redActivePick}
          ddVersion={ddVersion} champMap={champMap}
          expandedId={expandedEntry?.riotId ?? null}
          onPlayerClick={(e) => setExpandedEntry(prev => prev?.riotId === e.riotId ? null : e)}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#b91c1c", color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.4)", pointerEvents: "none" }}>
          {toast}
        </div>
      )}

      {/* Name settings modal */}
      {settingsOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={() => setSettingsOpen(false)}>
          <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 12, padding: 24, width: 320 }}
            onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 16px", color: "#e2e8f0" }}>Your display name</h4>
            <input
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              placeholder="Enter your name…"
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              autoFocus
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #2d2d4e", background: "#0f172a", color: "#e2e8f0", fontSize: 14, boxSizing: "border-box", outline: "none" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setSettingsOpen(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveName} style={{ flex: 1 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Team side panel ──────────────────────────────────────────────────────────
function TeamPanel({
  side, team, bans, picks, activeBanSlot, activePickSlot,
  ddVersion, champMap, expandedId, onPlayerClick,
}: {
  side: "blue" | "red";
  team: TournamentTeam | null;
  bans: string[];
  picks: { champion: string; position: string | null }[];
  activeBanSlot: number;
  activePickSlot: number;
  ddVersion: string;
  champMap: Record<string, ChampionData>;
  expandedId: string | null;
  onPlayerClick: (entry: TournamentRosterEntry) => void;
}) {
  const color = side === "blue" ? "#3b82f6" : "#ef4444";
  const roster = starters(team);

  return (
    <div style={{ width: 268, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color }}>{team?.name ?? (side === "blue" ? "Blue" : "Red")}</span>
        {team && <span style={{ fontSize: 11, color: "#8899aa" }}>{team.division}</span>}
      </div>

      {/* Ban slots */}
      <div style={{ display: "flex", gap: 5 }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const isActive = activeBanSlot === i;
          const champ = bans[i] ? champMap[bans[i]] : null;
          return (
            <div key={i} style={{
              width: 44, height: 44, borderRadius: 6, overflow: "hidden", position: "relative",
              border: `1.5px solid ${isActive ? color : bans[i] ? "#1e293b" : "#2d2d4e"}`,
              background: "#0f172a",
              boxShadow: isActive ? `0 0 8px ${color}88` : "none",
            }}>
              {champ ? (
                <>
                  <img src={champIconUrl(ddVersion, champ.image.full)} alt={bans[i]} width={44} height={44} style={{ display: "block", objectFit: "cover", filter: "grayscale(0.3)" }} />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#ef4444", fontSize: 18, fontWeight: 900 }}>✕</span>
                  </div>
                </>
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isActive && <span style={{ color, fontSize: 18, fontWeight: 700 }}>?</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pick rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const entry = roster[i];
          const pick = picks[i];
          const pickedChamp = pick ? champMap[pick.champion] : null;
          const isActive = activePickSlot === i;
          const isExpanded = entry?.riotId === expandedId;

          // Champion pool for display (top 5 mastery)
          const pool = entry?.profile?.topChampions.slice(0, 5).map((c) => ({
            name: c.championName, data: champMap[c.championName],
          })).filter((c) => c.data) ?? [];

          return (
            <div key={i}
              onClick={() => entry && onPlayerClick(entry)}
              style={{
                display: "flex", alignItems: "stretch",
                background: isExpanded ? (side === "blue" ? "#1a2d4a" : "#3a1515") : isActive ? (side === "blue" ? "#0f1f3d" : "#2d0f0f") : "#16213e",
                border: `1.5px solid ${isExpanded ? color : isActive ? color : "#2d2d4e"}`,
                borderRadius: 8, overflow: "hidden",
                boxShadow: isActive ? `0 0 10px ${color}66` : "none",
                cursor: entry ? "pointer" : "default",
                minHeight: 72,
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              {/* Champion / role portrait */}
              <div style={{ width: 64, height: 72, flexShrink: 0, background: "#0f172a", position: "relative", overflow: "hidden", order: side === "red" ? 1 : 0 }}>
                {pick && isRolePick(pick.champion) ? (
                  <RolePortrait champion={pick.champion} />
                ) : pickedChamp ? (
                  <img src={champIconUrl(ddVersion, pickedChamp.image.full)} alt={pick!.champion} width={64} height={72} style={{ display: "block", objectFit: "cover", objectPosition: "top" }} />
                ) : entry?.profile ? (
                  <img src={profileIconUrl(ddVersion, entry.profile.profileIconId)} alt="" width={40} height={40}
                    style={{ borderRadius: "50%", opacity: 0.5, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1e293b", border: "1px solid #cbd5e1", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
                )}
              </div>

              {/* Player info */}
              <div style={{ flex: 1, padding: "6px 8px", minWidth: 0, order: side === "red" ? 0 : 1, textAlign: side === "red" ? "right" : "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: side === "red" ? "flex-end" : "flex-start" }}>
                  {entry && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: POS_COLOR[entry.position] ?? "#cbd5e1", background: `${POS_COLOR[entry.position] ?? "#cbd5e1"}22`, padding: "1px 5px", borderRadius: 4 }}>
                      {entry.position === "JUNGLE" ? "JGL" : entry.position === "SUPPORT" ? "SUP" : entry.position}
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: pick && isRolePick(pick.champion) ? roleColor(pick.champion) : "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {pick ? (isRolePick(pick.champion) ? roleLabel(pick.champion) : pick.champion) : (entry ? entry.riotId.split("#")[0] : `Pick ${i + 1}`)}
                  </span>
                </div>
                {entry?.profile && (
                  <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 1 }}>
                    <RankBadge entry={entry.profile.ranked.soloQueue} size="sm" />
                    {" · "}Tier {entry.tierRank}
                  </div>
                )}
                {entry && (
                  <div style={{ marginTop: 3, display: "flex", justifyContent: side === "red" ? "flex-end" : "flex-start" }}>
                    <OpggPlayerLink riotId={entry.riotId} />
                  </div>
                )}
                {pool.length > 0 && (
                  <div style={{ display: "flex", gap: 3, marginTop: 5, justifyContent: side === "red" ? "flex-end" : "flex-start" }}>
                    {pool.map(({ name, data }) => (
                      <div key={name} title={name} style={{ width: 22, height: 22, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                        <img src={champIconUrl(ddVersion, data.image.full)} alt={name} width={22} height={22} style={{ display: "block", objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DraftFilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: "#8899aa", textTransform: "uppercase", letterSpacing: 1, minWidth: 40, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

// ─── Player detail panel (replaces champion grid) ─────────────────────────────

function fmtEST(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDuration(sec?: number): string {
  if (!sec) return "?";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function fmtK(n?: number): string {
  if (n == null) return "?";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function PlayerDetailPanel({
  entry, ddVersion, champMap, onClose,
}: {
  entry: TournamentRosterEntry;
  ddVersion: string;
  champMap: Record<string, ChampionData>;
  onClose: () => void;
}) {
  const { selected: queueFilter, toggle: toggleQueue, passes: queuePasses } = useQueueFilter();
  const entryPos = entry.position;
  const defaultPos: PosFilter = (entryPos === "SUB" || entryPos === "FILL") ? "ALL" : entryPos as PosFilter;
  const [champPosFilter, setChampPosFilter] = useState<PosFilter>(defaultPos);
  const profile = entry.profile;

  if (!profile) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ color: "#8899aa" }}>No profile data for {entry.riotId}</div>
        <button onClick={onClose} className="btn-secondary">Close</button>
      </div>
    );
  }

  const allMatches: MatchRecord[] = profile.matchHistory?.length
    ? profile.matchHistory : (profile.recentMatches ?? []);

  // Deduce which queue types we actually have
  const queuesPresent = [...new Set(allMatches.map((m) => m.queueId).filter(Boolean))] as number[];

  const matches = allMatches
    .filter((m) => queuePasses(m.queueId))
    .filter((m) => {
      if (champPosFilter === "ALL") return true;
      const role = (m.role ?? "").toUpperCase();
      if (role && role !== "NONE" && role !== "INVALID") {
        const ROLE_MATCH: Record<string, string[]> = {
          TOP: ["TOP"], JUNGLE: ["JUNGLE"],
          MID: ["MIDDLE", "MID"], BOT: ["BOTTOM", "BOT", "CARRY"], SUPPORT: ["UTILITY", "SUPPORT"],
        };
        return (ROLE_MATCH[champPosFilter] ?? []).includes(role);
      }
      const champ = champMap[m.championName];
      return champ ? filterByPosition(champ, champPosFilter) : false;
    });

  const champStats = computeChampStats(matches);
  const overall = computeOverallStats(matches);

  // Averages for extra stats
  const avgCs = matches.length && matches.some((m) => m.cs != null)
    ? (matches.reduce((s, m) => s + (m.cs ?? 0), 0) / matches.length).toFixed(1) : null;
  const avgCsMin = matches.length && matches.some((m) => m.csPerMin != null)
    ? (matches.reduce((s, m) => s + (m.csPerMin ?? 0), 0) / matches.length).toFixed(1) : null;
  const avgDmg = matches.length && matches.some((m) => m.damage != null)
    ? Math.round(matches.reduce((s, m) => s + (m.damage ?? 0), 0) / matches.length) : null;
  const avgVision = matches.length && matches.some((m) => m.visionScore != null)
    ? (matches.reduce((s, m) => s + (m.visionScore ?? 0), 0) / matches.length).toFixed(1) : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexShrink: 0 }}>
        <img src={profileIconUrl(ddVersion, profile.profileIconId)} width={48} height={48}
          style={{ borderRadius: 10, border: "2px solid #2d2d4e", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile.riotId}</div>
            <OpggPlayerLink riotId={entry.riotId} />
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1" }}>
            Lv {profile.summonerLevel}
            {" · "}<span style={{ color: POS_COLOR[entry.position] ?? "#cbd5e1" }}>{entry.position}</span>
            {" · "}Tier {entry.tierRank}
            {" · "}<span style={{ color: "#cbd5e1" }}>updated {new Date(profile.lastUpdated).toLocaleDateString()}</span>
          </div>
        </div>
        {overall && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: overall.winrate >= 50 ? "#4ade80" : "#f87171" }}>{overall.winrate}%</div>
            <div style={{ fontSize: 10, color: "#cbd5e1" }}>{overall.wins}W {overall.losses}L</div>
          </div>
        )}
        <button onClick={onClose}
          style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Rank cards */}
        <div style={{ display: "flex", gap: 10 }}>
          <RankCard label="Solo/Duo" entry={profile.ranked.soloQueue} />
          <RankCard label="Flex" entry={profile.ranked.flexQueue} />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {queuesPresent.length > 0 && (
            <DraftFilterRow label="Queue">
              <button onClick={() => toggleQueue("all")} style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                border: queueFilter.size === 0 ? "1px solid #3b82f6" : "1px solid #2d2d4e",
                background: queueFilter.size === 0 ? "#1d4ed8" : "#16213e",
                color: queueFilter.size === 0 ? "#fff" : "#cbd5e1",
                fontWeight: queueFilter.size === 0 ? 600 : 400,
              }}>All ({allMatches.length})</button>
              {queuesPresent.map((q) => {
                const active = queueFilter.has(q);
                return (
                  <button key={q} onClick={() => toggleQueue(q)} style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                    border: active ? "1px solid #3b82f6" : "1px solid #2d2d4e",
                    background: active ? "#1d4ed8" : "#16213e",
                    color: active ? "#fff" : "#cbd5e1",
                    fontWeight: active ? 600 : 400,
                  }}>{queueLabel(q)} ({allMatches.filter((m) => m.queueId === q).length})</button>
                );
              })}
            </DraftFilterRow>
          )}
          <DraftFilterRow label="Role">
            {(["ALL", "TOP", "JUNGLE", "MID", "BOT", "SUPPORT"] as PosFilter[]).map((f) => (
              <button key={f} onClick={() => setChampPosFilter(f)} style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                border: champPosFilter === f ? "1px solid #3b82f6" : "1px solid #2d2d4e",
                background: champPosFilter === f ? "#1d4ed8" : "#16213e",
                color: champPosFilter === f ? "#fff" : "#cbd5e1",
                fontWeight: champPosFilter === f ? 600 : 400,
              }}>
                {f === "ALL" ? "All" : f === "JUNGLE" ? "JGL" : f === "SUPPORT" ? "SUP" : f === "BOT" ? "ADC" : f}
              </button>
            ))}
          </DraftFilterRow>
        </div>

        {/* Overall stats bar */}
        {overall && (
          <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              {/* Win/loss + recent bars */}
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end" }}>
                {matches.slice(0, 20).map((m, i) => (
                  <div key={i} title={`${m.championName} ${m.win ? "W" : "L"}`}
                    style={{ width: 7, height: m.win ? 26 : 16, borderRadius: 2, background: m.win ? "#4ade80" : "#f87171", flexShrink: 0 }} />
                ))}
              </div>
              <div style={{ width: 1, height: 32, background: "#2d2d4e", flexShrink: 0 }} />
              <StatBlock label="WR" value={`${overall.winrate}%`} color={overall.winrate >= 50 ? "#4ade80" : "#f87171"} sub={`${overall.wins}W ${overall.losses}L`} />
              <div style={{ width: 1, height: 32, background: "#2d2d4e", flexShrink: 0 }} />
              <StatBlock label="KDA" value={`${overall.kda}:1`} color={parseFloat(overall.kda) >= 3 ? "#4ade80" : "#e2e8f0"} sub={`${overall.avgK} / ${overall.avgD} / ${overall.avgA}`} />
              {avgCs && <><div style={{ width: 1, height: 32, background: "#2d2d4e", flexShrink: 0 }} /><StatBlock label="CS" value={avgCs} color="#cbd5e1" sub={avgCsMin ? `${avgCsMin}/min` : ""} /></>}
              {avgDmg && <><div style={{ width: 1, height: 32, background: "#2d2d4e", flexShrink: 0 }} /><StatBlock label="DMG" value={fmtK(avgDmg)} color="#f59e0b" sub="avg/game" /></>}
              {avgVision && <><div style={{ width: 1, height: 32, background: "#2d2d4e", flexShrink: 0 }} /><StatBlock label="Vision" value={avgVision} color="#60a5fa" sub="avg" /></>}
            </div>
          </div>
        )}

        {/* Champion stats */}
        {champStats.length > 0 && (
          <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Champion Stats</div>
            {/* Header row — mirrors data row flex layout exactly */}
            <div style={{ display: "flex", gap: 10, marginBottom: 6, padding: "0 10px" }}>
              <div style={{ width: 32, flexShrink: 0 }} />
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", minWidth: 20 }}>G</div>
              <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", minWidth: 56 }}>WR</div>
              <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", minWidth: 44 }}>KDA</div>
              <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", minWidth: 72 }}>K/D/A</div>
              <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", minWidth: 34 }}>CS/m</div>
              <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", minWidth: 48 }}>DMG</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid #1e293b" }}>
              {champStats.map((cs, idx) => {
                const champ = champMap[cs.name];
                return (
                  <div key={cs.name} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "7px 10px",
                    background: idx % 2 === 0 ? "#0a0f1a" : "#1e293b",
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "#1e293b" }}>
                      {champ && <img src={champIconUrl(ddVersion, champ.image.full)} width={32} height={32} style={{ display: "block", objectFit: "cover" }} />}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#e2e8f0" }}>{cs.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", minWidth: 20, textAlign: "right" }}>{cs.games}g</div>
                    <div style={{ minWidth: 56, display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${cs.winrate}%`, height: "100%", background: cs.winrate >= 50 ? "#4ade80" : "#f87171" }} />
                      </div>
                      <div style={{ fontSize: 10, color: cs.winrate >= 50 ? "#4ade80" : "#f87171", textAlign: "right", fontWeight: 600 }}>{cs.winrate}%</div>
                    </div>
                    <div style={{ fontSize: 11, color: cs.kda >= 3 ? "#4ade80" : "#cbd5e1", minWidth: 44, textAlign: "right", fontWeight: 600 }}>
                      {cs.kda >= 99 ? "∞" : cs.kda.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: "#cbd5e1", minWidth: 72, textAlign: "right" }}>
                      {cs.avgK.toFixed(1)}/{cs.avgD.toFixed(1)}/{cs.avgA.toFixed(1)}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", minWidth: 34, textAlign: "right" }}>
                      {cs.avgCsMin != null ? cs.avgCsMin.toFixed(1) : "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "#f59e0b", minWidth: 48, textAlign: "right" }}>
                      {cs.avgDmg != null ? fmtK(Math.round(cs.avgDmg)) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mastery champion pool */}
        {profile.topChampions.length > 0 && (
          <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Champion Mastery</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {profile.topChampions.map((c) => {
                const champ = champMap[c.championName];
                return (
                  <div key={c.championName} title={`${c.championName} — M${c.level} — ${c.championPoints.toLocaleString()} pts`}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 52 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", border: `2px solid ${masteryColor(c.level)}`, flexShrink: 0 }}>
                      {champ && <img src={champIconUrl(ddVersion, champ.image.full)} width={44} height={44} style={{ display: "block", objectFit: "cover" }} />}
                    </div>
                    <div style={{ fontSize: 10, color: masteryColor(c.level), fontWeight: 700 }}>M{c.level}</div>
                    <div style={{ fontSize: 9, color: "#8899aa" }}>{(c.championPoints / 1000).toFixed(0)}k</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rank history */}
        {profile.rankedHistory && profile.rankedHistory.length > 1 && (
          <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Rank History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...profile.rankedHistory].reverse().map((snap: RankedSnapshot, i) => (
                <div key={i} style={{ display: "flex", gap: 12, fontSize: 12, alignItems: "center" }}>
                  <span style={{ color: "#cbd5e1", fontSize: 11, minWidth: 72 }}>{new Date(snap.timestamp).toLocaleDateString()}</span>
                  <span style={{ color: snap.soloQueue ? tierColor(snap.soloQueue.tier) : "#8899aa", fontWeight: snap.soloQueue ? 600 : 400 }}>
                    {snap.soloQueue ? `${snap.soloQueue.tier} ${snap.soloQueue.rank} ${snap.soloQueue.leaguePoints}LP` : "Unranked"}
                  </span>
                  {snap.flexQueue && (
                    <span style={{ color: "#cbd5e1", fontSize: 11 }}>
                      Flex: <span style={{ color: tierColor(snap.flexQueue.tier) }}>{snap.flexQueue.tier} {snap.flexQueue.rank}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent games */}
        {matches.length > 0 && (
          <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              Recent Games ({matches.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {matches.map((m) => {
                const champ = champMap[m.championName];
                const ratio = m.kda.deaths === 0 ? "∞" : ((m.kda.kills + m.kda.assists) / m.kda.deaths).toFixed(2);
                const ratioNum = m.kda.deaths === 0 ? 99 : (m.kda.kills + m.kda.assists) / m.kda.deaths;
                return (
                  <div key={m.matchId} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7,
                    background: m.win ? "rgba(74,222,128,0.05)" : "rgba(248,113,113,0.05)",
                    borderLeft: `3px solid ${m.win ? "#4ade80" : "#f87171"}`,
                  }}>
                    {/* Champion icon */}
                    <div style={{ width: 36, height: 36, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                      {champ && <img src={champIconUrl(ddVersion, champ.image.full)} width={36} height={36} style={{ display: "block", objectFit: "cover" }} />}
                    </div>
                    {/* Win/champ name */}
                    <div style={{ minWidth: 46, flexShrink: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: m.win ? "#4ade80" : "#f87171" }}>{m.win ? "Win" : "Loss"}</div>
                      <div style={{ fontSize: 9, color: "#8899aa" }}>{queueLabel(m.queueId)}</div>
                    </div>
                    {/* KDA */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", minWidth: 54, flexShrink: 0 }}>
                      {m.kda.kills}/{m.kda.deaths}/{m.kda.assists}
                    </div>
                    {/* KDA ratio */}
                    <div style={{ fontSize: 11, color: ratioNum >= 3 ? "#4ade80" : ratioNum >= 2 ? "#cbd5e1" : "#f87171", minWidth: 44, flexShrink: 0 }}>
                      {ratio} KDA
                    </div>
                    {/* CS */}
                    {m.cs != null && (
                      <div style={{ fontSize: 11, color: "#cbd5e1", minWidth: 44, flexShrink: 0 }}>
                        {m.cs} CS
                        {m.csPerMin != null && <span style={{ color: "#8899aa" }}> ({m.csPerMin}/m)</span>}
                      </div>
                    )}
                    {/* Damage */}
                    {m.damage != null && (
                      <div style={{ fontSize: 11, color: "#f59e0b", minWidth: 44, flexShrink: 0 }}>
                        {fmtK(m.damage)}
                      </div>
                    )}
                    {/* Vision */}
                    {m.visionScore != null && (
                      <div style={{ fontSize: 11, color: "#60a5fa", minWidth: 30, flexShrink: 0 }}>
                        {m.visionScore}v
                      </div>
                    )}
                    {/* Duration + date */}
                    <div style={{ fontSize: 10, color: "#cbd5e1", marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
                      <div>{fmtDuration(m.gameDuration)}</div>
                      <div>{new Date(m.gameDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {matches.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, color: "#cbd5e1", fontSize: 13 }}>
            No match history — run Refresh Data on the Tournament page to fetch recent games.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rank card ────────────────────────────────────────────────────────────────
function RankCard({ label, entry }: { label: string; entry: RankedEntry | null }) {
  return (
    <div style={{ flex: 1, background: "#0f172a", border: `1px solid ${entry ? tierColor(entry.tier) + "44" : "#2d2d4e"}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: "#8899aa", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      {entry ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TierBadge tier={entry.tier} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: tierColor(entry.tier) }}>{entry.tier} {entry.rank}</div>
            <div style={{ fontSize: 11, color: "#cbd5e1" }}>{entry.leaguePoints} LP</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: Math.round(entry.wins / (entry.wins + entry.losses) * 100) >= 50 ? "#4ade80" : "#f87171" }}>
              {Math.round(entry.wins / (entry.wins + entry.losses) * 100)}%
            </div>
            <div style={{ fontSize: 10, color: "#cbd5e1" }}>{entry.wins}W {entry.losses}L</div>
            {entry.hotStreak && <div style={{ fontSize: 9, color: "#f59e0b", marginTop: 2 }}>🔥 Hot Streak</div>}
          </div>
        </div>
      ) : (
        <div style={{ color: "#cbd5e1", fontSize: 13 }}>Unranked</div>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const abbr: Record<string, string> = {
    IRON: "I", BRONZE: "B", SILVER: "S", GOLD: "G", PLATINUM: "P",
    EMERALD: "E", DIAMOND: "D", MASTER: "M", GRANDMASTER: "GM", CHALLENGER: "C",
  };
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      background: `${tierColor(tier)}22`, border: `2px solid ${tierColor(tier)}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 900, color: tierColor(tier),
    }}>
      {abbr[tier] ?? tier[0]}
    </div>
  );
}

// ─── Utility components ───────────────────────────────────────────────────────
function RolePortrait({ champion }: { champion: string }) {
  const archetype = ROLE_ARCHETYPES.find((r) => r.id === champion);
  const color = archetype?.color ?? "#cbd5e1";
  return (
    <div style={{ width: "100%", height: "100%", background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {archetype ? <archetype.Icon size={32} color={color} /> : (
        <span style={{ fontSize: 10, fontWeight: 800, color, textAlign: "center" }}>{roleLabel(champion)}</span>
      )}
    </div>
  );
}

function DraftNameEditor({ draft, onUpdate }: { draft: DraftState; onUpdate: (patch: { name?: string; description?: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(draft.name ?? "");

  function save() {
    setEditing(false);
    if (val !== (draft.name ?? "")) onUpdate({ name: val });
  }

  if (editing) {
    return (
      <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setVal(draft.name ?? ""); } }}
        style={{ fontSize: 13, fontWeight: 600, background: "#0f172a", color: "#fff", border: "1px solid #3b82f6", borderRadius: 4, padding: "3px 8px", width: 180 }}
        placeholder="Draft name…"
      />
    );
  }

  return (
    <button onClick={() => { setEditing(true); setVal(draft.name ?? ""); }}
      style={{ background: "none", border: "1px solid #2d2d4e", borderRadius: 6, color: draft.name ? "#e2e8f0" : "#cbd5e1", cursor: "pointer", fontSize: 13, padding: "3px 10px" }}>
      {draft.name || "Name draft…"}
    </button>
  );
}

function DraftListRow({ draft, blueTeam, redTeam, ddVersion, champMap, onOpen, onDelete, onUpdate }: {
  draft: DraftState;
  blueTeam: TournamentTeam | undefined;
  redTeam: TournamentTeam | undefined;
  ddVersion: string;
  champMap: Record<string, ChampionData>;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onUpdate: (patch: { name?: string; description?: string }) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameVal, setNameVal] = useState(draft.name ?? "");
  const [descVal, setDescVal] = useState(draft.description ?? "");

  function saveName() {
    setEditingName(false);
    if (nameVal !== (draft.name ?? "")) onUpdate({ name: nameVal });
  }

  function saveDesc() {
    setEditingDesc(false);
    if (descVal !== (draft.description ?? "")) onUpdate({ description: descVal });
  }

  return (
    <div style={{ background: "#16213e", border: "1px solid #2d2d4e", borderRadius: 10, overflow: "hidden" }}>
      <div onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", cursor: "pointer" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <input autoFocus value={nameVal} onChange={(e) => setNameVal(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setNameVal(draft.name ?? ""); } }}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 14, fontWeight: 700, background: "#0f172a", color: "#fff", border: "1px solid #3b82f6", borderRadius: 4, padding: "2px 8px", width: "100%" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {draft.name && <span style={{ fontWeight: 700, fontSize: 14 }}>{draft.name}</span>}
              <span style={{ color: "#60a5fa", fontWeight: 600, fontSize: draft.name ? 12 : 14 }}>{blueTeam?.name ?? draft.blueTeam}</span>
              <span style={{ color: "#8899aa", fontSize: 12 }}>vs</span>
              <span style={{ color: "#f87171", fontWeight: 600, fontSize: draft.name ? 12 : 14 }}>{redTeam?.name ?? draft.redTeam}</span>
              <button onClick={(e) => { e.stopPropagation(); setEditingName(true); setNameVal(draft.name ?? ""); }}
                style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 11, padding: "1px 6px", borderRadius: 4 }}>
                {draft.name ? "rename" : "+ name"}
              </button>
            </div>
          )}
        </div>
        <BanIcons bans={[...draft.blueBans, ...draft.redBans]} ddVersion={ddVersion} champMap={champMap} />
        <div style={{ fontSize: 12, color: "#cbd5e1", minWidth: 160, textAlign: "right" }}>
          <div>{draft.phase === "complete" ? "Complete" : `${draft.bluePicks.length + draft.redPicks.length}/10 picks`}</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>
            Created {fmtEST(draft.createdAt)}
          </div>
          {draft.updatedAt && draft.updatedAt !== draft.createdAt && (
            <div style={{ fontSize: 11 }}>
              Updated {fmtEST(draft.updatedAt)}
            </div>
          )}
        </div>
        <button onClick={onDelete} style={{ background: "none", border: "none", color: "#8899aa", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>
      </div>
      {/* Description row */}
      <div onClick={(e) => e.stopPropagation()} style={{ borderTop: "1px solid #1e293b", padding: "8px 18px" }}>
        {editingDesc ? (
          <textarea autoFocus value={descVal} onChange={(e) => setDescVal(e.target.value)}
            onBlur={saveDesc}
            onKeyDown={(e) => { if (e.key === "Escape") { setEditingDesc(false); setDescVal(draft.description ?? ""); } }}
            style={{ width: "100%", background: "#0f172a", color: "#e2e8f0", border: "1px solid #3b82f6", borderRadius: 4, padding: "6px 8px", fontSize: 12, resize: "none", height: 60, boxSizing: "border-box" }}
          />
        ) : (
          <div onClick={() => { setEditingDesc(true); setDescVal(draft.description ?? ""); }}
            style={{ fontSize: 12, color: "#cbd5e1", cursor: "text", minHeight: 20 }}>
            {draft.description || "Add a description…"}
          </div>
        )}
      </div>
    </div>
  );
}

function BanIcons({ bans, ddVersion, champMap }: { bans: string[]; ddVersion: string; champMap: Record<string, ChampionData> }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {bans.slice(0, 10).map((name, i) => {
        const champ = champMap[name];
        return champ ? (
          <div key={i} style={{ width: 24, height: 24, borderRadius: 4, overflow: "hidden", opacity: 0.5 }}>
            <img src={champIconUrl(ddVersion, champ.image.full)} alt={name} width={24} height={24} style={{ display: "block", objectFit: "cover", filter: "grayscale(0.5)" }} />
          </div>
        ) : null;
      })}
    </div>
  );
}

function TeamSelect({ teams, value, exclude, onChange }: {
  teams: TournamentTeam[]; value: string; exclude: string; onChange: (id: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      width: "100%", padding: "10px 12px", borderRadius: 8,
      border: "1px solid #cbd5e1", background: "#0f172a",
      color: "#e2e8f0", fontSize: 14, outline: "none", cursor: "pointer",
    }}>
      <option value="">Select team…</option>
      {["Ho-Oh", "Lugia"].map((div) => (
        <optgroup key={div} label={div}>
          {teams.filter((t) => t.division === div && t.id !== exclude).map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.isOurTeam ? " (Us)" : ""}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
