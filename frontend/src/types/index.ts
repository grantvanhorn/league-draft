export type Position = "TOP" | "JUNGLE" | "MID" | "BOT" | "SUPPORT" | "FILL";
export type TournamentPosition = Position | "SUB";

export interface TournamentRosterEntry {
  riotId: string;
  position: TournamentPosition;
  tierRank: number;
  puuid: string | null;
  profile: PlayerProfile | null;
}

export interface TournamentTeam {
  id: string;
  name: string;
  abbreviation: string;
  division: "Ho-Oh" | "Lugia";
  captain: string;
  isOurTeam: boolean;
  roster: TournamentRosterEntry[];
}

export interface ImportStatus {
  running: boolean;
  total: number;
  completed: number;
  current: string | null;
  failed: { riotId: string; error: string }[];
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RankedEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
}

export interface MatchRecord {
  matchId: string;
  championName: string;
  win: boolean;
  kda: { kills: number; deaths: number; assists: number };
  role: string;
  gameDate: number;
  gameDuration?: number;
  cs?: number;
  csPerMin?: number;
  damage?: number;
  gold?: number;
  visionScore?: number;
  queueId?: number;
  lpDiff?: number;
  lpAfter?: number;
}

export interface RankedSnapshot {
  timestamp: string;
  soloQueue: RankedEntry | null;
  flexQueue: RankedEntry | null;
}

export interface PlayerProfile {
  puuid: string;
  riotId: string;
  gameName: string;
  tagLine: string;
  summonerId: string;
  summonerLevel: number;
  profileIconId: number;
  ranked: {
    soloQueue: RankedEntry | null;
    flexQueue: RankedEntry | null;
  };
  topChampions: {
    championId: number;
    championName: string;
    championPoints: number;
    level: number;
  }[];
  recentMatches: MatchRecord[];
  matchHistory: MatchRecord[];
  rankedHistory: RankedSnapshot[];
  preferredPositions: Position[];
  notes: string;
  lastUpdated: string;
}

export interface Team {
  id: string;
  name: string;
  players: PlayerProfile[];
}

export interface DraftState {
  id: string;
  blueTeam: string;
  redTeam: string;
  blueTeamId?: string;
  redTeamId?: string;
  phase: string;
  turn: "blue" | "red";
  blueBans: string[];
  redBans: string[];
  bluePicks: { champion: string; position: Position | null }[];
  redPicks: { champion: string; position: Position | null }[];
  createdAt: string;
  updatedAt?: string;
  name?: string;
  description?: string;
}

export interface ChampionData {
  id: string;
  name: string;
  key: string;
  title: string;
  tags: string[];
  image: { full: string };
}

export interface DeathEvent {
  matchId: string;
  gameDate: number;
  gameIndex: number;
  timestamp: number;
  position: { x: number; y: number };
  killerChampion: string | null;
  killerName: string | null;
  assistingChampions: string[];
  victimChampion: string;
  win: boolean;
}

export interface HeatmapGameSummary {
  matchId: string;
  gameDate: number;
  gameIndex: number;
  champion: string;
  win: boolean;
  deathCount: number;
}

export interface DeathHeatmapData {
  puuid: string;
  riotId: string;
  deaths: DeathEvent[];
  games: HeatmapGameSummary[];
}
