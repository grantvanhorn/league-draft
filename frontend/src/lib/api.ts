import { PlayerProfile, Team, DraftState, ChampionData, TournamentTeam, ImportStatus, DeathHeatmapData } from "../types";

const BASE = "/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// Players
export const getPlayers = () => apiFetch<PlayerProfile[]>("/players");
export const getPlayer = (puuid: string) => apiFetch<PlayerProfile>(`/players/${puuid}`);
export const addPlayer = (riotId: string) =>
  apiFetch<PlayerProfile>("/players", {
    method: "POST",
    body: JSON.stringify({ riotId }),
  });
export const refreshPlayer = (puuid: string) =>
  apiFetch<PlayerProfile>(`/players/${puuid}/refresh`, { method: "PUT" });
export const updatePlayerNotes = (puuid: string, notes: string) =>
  apiFetch<PlayerProfile>(`/players/${puuid}`, {
    method: "PATCH",
    body: JSON.stringify({ notes }),
  });
export const deletePlayer = (puuid: string) =>
  apiFetch<{ success: boolean }>(`/players/${puuid}`, { method: "DELETE" });
export const submitLpHistory = (puuid: string, payload: unknown) =>
  apiFetch<{ matched: number; total: number }>(`/players/${puuid}/lp-history`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

// Team
export const getTeam = () => apiFetch<Team>("/team");
export const updateTeamName = (name: string) =>
  apiFetch<Team>("/team/name", {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
export const addToTeam = (puuid: string) =>
  apiFetch<Team>("/team/players", {
    method: "POST",
    body: JSON.stringify({ puuid }),
  });
export const removeFromTeam = (puuid: string) =>
  apiFetch<Team>(`/team/players/${puuid}`, { method: "DELETE" });

// Drafts
export const getDrafts = () => apiFetch<DraftState[]>("/drafts");
export const getDraft = (id: string) => apiFetch<DraftState>(`/drafts/${id}`);
export const createDraft = (payload: {
  blueTeamId?: string;
  redTeamId?: string;
}) =>
  apiFetch<{ draft: DraftState; sequence: unknown[] }>("/drafts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const draftAction = (
  id: string,
  champion: string,
  position?: string
) =>
  apiFetch<{ draft: DraftState; nextStep: unknown }>(`/drafts/${id}/action`, {
    method: "POST",
    body: JSON.stringify({ champion, position }),
  });
export const updateDraft = (id: string, patch: { name?: string; description?: string }) =>
  apiFetch<{ draft: DraftState }>(`/drafts/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const undoDraft = (id: string) =>
  apiFetch<{ draft: DraftState }>(`/drafts/${id}/undo`, { method: "POST" });
export const deleteDraft = (id: string) =>
  apiFetch<{ success: boolean }>(`/drafts/${id}`, { method: "DELETE" });

// Match history
export interface WeekSummary {
  id: string;
  weekNumber: number;
  label?: string;
  seriesCount: number;
  fetchedCount: number;
  totalGames: number;
}
export const getMatchWeeks = () => apiFetch<WeekSummary[]>("/match-history/weeks");
export const getMatchWeek = (weekId: string) => apiFetch<any>(`/match-history/weeks/${weekId}`);
export const createMatchWeek = (payload: { weekNumber: number; label?: string; series: any[] }) =>
  apiFetch<any>("/match-history/weeks", { method: "POST", body: JSON.stringify(payload) });
export const fetchWeekData = (weekId: string) =>
  apiFetch<any>(`/match-history/weeks/${weekId}/fetch`, { method: "POST" });
export const getTournamentMatchIds = () => apiFetch<string[]>("/match-history/tournament-ids");
export const getPlayerTournamentGames = (puuid: string) =>
  apiFetch<import("../types").MatchRecord[]>(`/players/${puuid}/tournament-games`);
export const updateSeriesSubstitutes = (
  weekId: string,
  seriesId: string,
  substitutes: { riotIdGameName: string; replacingRiotId: string; teamId: string }[]
) =>
  apiFetch<any>(`/match-history/weeks/${weekId}/series/${seriesId}/substitutes`, {
    method: "PATCH",
    body: JSON.stringify({ substitutes }),
  });

// Champions
export const getChampions = () => apiFetch<ChampionData[]>("/champions");
export const getDDVersion = () =>
  apiFetch<{ version: string }>("/champions/version");

// Tournament
export const getTournamentTeams = () =>
  apiFetch<TournamentTeam[]>("/tournament/teams");
export const getTournamentTeam = (id: string) =>
  apiFetch<TournamentTeam>(`/tournament/teams/${id}`);
export const seedTournament = () =>
  apiFetch<{ message: string; teams: TournamentTeam[] }>("/tournament/seed", {
    method: "POST",
  });
export const startImport = () =>
  apiFetch<{ message: string; status: ImportStatus }>("/tournament/import", {
    method: "POST",
  });
export const getImportStatus = () =>
  apiFetch<ImportStatus>("/tournament/import/status");
export const retryImport = () =>
  apiFetch<{ message: string; status: ImportStatus }>("/tournament/import/retry", {
    method: "POST",
  });
export const refreshTournament = () =>
  apiFetch<{ message: string; status: ImportStatus }>("/tournament/refresh", {
    method: "POST",
  });
export const deepImportTournament = () =>
  apiFetch<{ message: string; status: ImportStatus }>("/tournament/import/deep", {
    method: "POST",
  });

// Refetch
export interface RefetchStatus {
  running: boolean;
  phase: "idle" | "fetching" | "rederiving" | "done" | "stopped" | "error";
  totalMatchIds: number;
  alreadyCached: number;
  cachedOnDisk: number;
  fetchedCount: number;
  failedCount: number;
  rederivingPlayer: string | null;
  currentMatchId: string | null;
  errors: { matchId: string; error: string }[];
  startedAt: string | null;
  finishedAt: string | null;
}
export const getRefetchStatus = () => apiFetch<RefetchStatus>("/refetch/status");
export const startRefetch = () =>
  apiFetch<{ started: boolean; status: RefetchStatus }>("/refetch/start", { method: "POST" });
export const stopRefetch = () =>
  apiFetch<{ stopping: boolean }>("/refetch/stop", { method: "POST" });
export const importExternalData = (puuid: string, payload: unknown) =>
  apiFetch<{ source: string; matched: number; totalGames: number }>(`/players/${puuid}/import`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

// Death heatmap
export const getDeathHeatmap = (gameName: string, tagLine: string) =>
  apiFetch<DeathHeatmapData>(`/death-heatmap/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
