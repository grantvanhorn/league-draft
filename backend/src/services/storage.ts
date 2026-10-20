import fs from "fs";
import path from "path";
import { AppData, PlayerProfile, Team, DraftState, TournamentTeam, MatchWeek } from "../types";

const DATA_FILE = path.join(__dirname, "../../data/profiles.json");

const defaultData: AppData = {
  ourTeam: {
    id: "ours",
    name: "Collision Time",
    players: [],
  },
  tournamentTeams: [],
  players: [],
  drafts: [],
  matchWeeks: [],
};

export function readData(): AppData {
  if (!fs.existsSync(DATA_FILE)) {
    writeData(defaultData);
    return defaultData;
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const data = JSON.parse(raw) as AppData;
  if (!data.tournamentTeams) data.tournamentTeams = [];
  if (!data.matchWeeks) data.matchWeeks = [];
  // migration: backfill accumulated history fields on existing profiles
  for (const p of data.players) {
    if (!p.matchHistory) p.matchHistory = p.recentMatches ?? [];
    if (!p.rankedHistory) {
      p.rankedHistory = p.ranked
        ? [{ timestamp: p.lastUpdated ?? new Date().toISOString(), soloQueue: p.ranked.soloQueue, flexQueue: p.ranked.flexQueue }]
        : [];
    }
  }
  return data;
}

export function writeData(data: AppData): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export function getPlayer(puuid: string): PlayerProfile | undefined {
  return readData().players.find((p) => p.puuid === puuid);
}

export function upsertPlayer(profile: PlayerProfile): void {
  const data = readData();
  const idx = data.players.findIndex((p) => p.puuid === profile.puuid);
  if (idx >= 0) {
    data.players[idx] = profile;
  } else {
    data.players.push(profile);
  }
  writeData(data);
}

export function deletePlayer(puuid: string): boolean {
  const data = readData();
  const before = data.players.length;
  data.players = data.players.filter((p) => p.puuid !== puuid);
  // Remove from our team if present
  data.ourTeam.players = data.ourTeam.players.filter((id) => id !== puuid);
  writeData(data);
  return data.players.length < before;
}

export function getOurTeam(): Team {
  return readData().ourTeam;
}

export function updateOurTeam(team: Partial<Team>): Team {
  const data = readData();
  data.ourTeam = { ...data.ourTeam, ...team };
  writeData(data);
  return data.ourTeam;
}

export function saveDraft(draft: DraftState): void {
  draft.updatedAt = new Date().toISOString();
  const data = readData();
  const idx = data.drafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) {
    data.drafts[idx] = draft;
  } else {
    data.drafts.push(draft);
  }
  writeData(data);
}

export function getDraft(id: string): DraftState | undefined {
  return readData().drafts.find((d) => d.id === id);
}

export function getDrafts(): DraftState[] {
  return readData().drafts;
}

export function getTournamentTeams(): TournamentTeam[] {
  return readData().tournamentTeams;
}

export function getTournamentTeam(id: string): TournamentTeam | undefined {
  return readData().tournamentTeams.find((t) => t.id === id);
}

export function upsertTournamentTeam(team: TournamentTeam): void {
  const data = readData();
  const idx = data.tournamentTeams.findIndex((t) => t.id === team.id);
  if (idx >= 0) {
    data.tournamentTeams[idx] = team;
  } else {
    data.tournamentTeams.push(team);
  }
  writeData(data);
}

export function setTournamentTeams(teams: TournamentTeam[]): void {
  const data = readData();
  data.tournamentTeams = teams;
  writeData(data);
}

export function findPlayerByRiotId(riotId: string): PlayerProfile | undefined {
  return readData().players.find(
    (p) => p.riotId.toLowerCase() === riotId.toLowerCase()
  );
}

export function getMatchWeeks(): MatchWeek[] {
  return readData().matchWeeks;
}

export function getMatchWeek(id: string): MatchWeek | undefined {
  return readData().matchWeeks.find((w) => w.id === id);
}

export function upsertMatchWeek(week: MatchWeek): void {
  const data = readData();
  const idx = data.matchWeeks.findIndex((w) => w.id === week.id);
  if (idx >= 0) {
    data.matchWeeks[idx] = week;
  } else {
    data.matchWeeks.push(week);
  }
  writeData(data);
}
