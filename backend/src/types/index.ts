export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface Summoner {
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export interface RankedEntry {
  leagueId: string;
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
  inactive: boolean;
}

export interface ChampionMastery {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
  championPointsSinceLastLevel: number;
  championPointsUntilNextLevel: number;
  chestGranted: boolean;
  tokensEarned: number;
  summonerId: string;
}

export interface MatchParticipant {
  puuid: string;
  summonerName: string;
  championId: number;
  championName: string;
  teamId: number;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  role: string;
  lane: string;
  teamPosition: string;
  totalDamageDealtToChampions: number;
  visionScore: number;
  goldEarned: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
}

export interface TeamObjectives {
  baron: { first: boolean; kills: number };
  champion: { first: boolean; kills: number };
  dragon: { first: boolean; kills: number };
  inhibitor: { first: boolean; kills: number };
  riftHerald: { first: boolean; kills: number };
  tower: { first: boolean; kills: number };
}

export interface TeamInfo {
  teamId: number;
  win: boolean;
  bans: { championId: number; pickTurn: number }[];
  objectives: TeamObjectives;
}

export interface MatchInfo {
  gameId: number;
  gameMode: string;
  gameType: string;
  queueId: number;
  gameDuration: number;
  gameStartTimestamp: number;
  participants: MatchParticipant[];
  teams?: TeamInfo[];
}

export interface Match {
  metadata: { matchId: string; participants: string[] };
  info: MatchInfo;
}

export type Position = "TOP" | "JUNGLE" | "MID" | "BOT" | "SUPPORT" | "FILL";

export interface RankedSnapshot {
  timestamp: string;
  soloQueue: RankedEntry | null;
  flexQueue: RankedEntry | null;
}

export interface MatchRecord {
  matchId: string;
  championName: string;
  win: boolean;
  kda: { kills: number; deaths: number; assists: number };
  role: string;
  gameDate: number;
  // extended stats
  gameDuration: number;    // seconds
  cs: number;              // minions + neutral
  csPerMin: number;
  damage: number;          // total damage to champions
  gold: number;
  visionScore: number;
  queueId: number;         // 420=ranked solo, 440=flex, 400=normal, 450=ARAM
  // LP data sourced from Mobalytics (optional, enriched post-import)
  lpDiff?: number;         // LP gained/lost this game
  lpAfter?: number;        // absolute LP value after game (e.g. 1101 = Silver I 1LP)
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
  // recentMatches: last 20 for UI display (slice of matchHistory)
  recentMatches: MatchRecord[];
  // matchHistory: all matches ever fetched, deduped by matchId
  matchHistory: MatchRecord[];
  // rankedHistory: timestamped rank snapshots on each refresh
  rankedHistory: RankedSnapshot[];
  preferredPositions: Position[];
  notes: string;
  lastUpdated: string;
}

export interface Team {
  id: "ours" | string;
  name: string;
  players: string[]; // puuids
}

export interface DraftState {
  id: string;
  blueTeam: string;
  redTeam: string;
  blueTeamId?: string; // tournament team id
  redTeamId?: string;  // tournament team id
  phase:
    | "ban1"
    | "ban2"
    | "ban3"
    | "ban4"
    | "ban5"
    | "pick1"
    | "pick2"
    | "pick3"
    | "pick4"
    | "pick5"
    | "complete";
  turn: "blue" | "red";
  blueBans: string[];
  redBans: string[];
  bluePicks: { champion: string; position: Position | null }[];
  redPicks: { champion: string; position: Position | null }[];
  createdAt: string;
  updatedAt: string;
  name?: string;
  description?: string;
}

export type TournamentPosition = Position | "SUB";

export interface TournamentRosterEntry {
  riotId: string;
  position: TournamentPosition;
  tierRank: number;
  puuid: string | null;
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

export interface RefetchStatus {
  running: boolean;
  phase: "idle" | "fetching" | "rederiving" | "done" | "stopped" | "error";
  totalMatchIds: number;
  alreadyCached: number;
  fetchedCount: number;
  failedCount: number;
  rederivingPlayer: string | null;
  currentMatchId: string | null;
  errors: { matchId: string; error: string }[];
  startedAt: string | null;
  finishedAt: string | null;
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

export interface SeriesGame {
  gameNumber: number;
  matchId: string;
  data?: Match;
  fetchedAt?: string;
}

export interface SeriesSubstitute {
  riotIdGameName: string;  // in-game name (e.g. "SeagullPrincess")
  replacingRiotId: string; // roster player being replaced (e.g. "DarrowTheReaper#red")
  teamId: string;          // which tournament team they're subbing for
}

export interface MatchSeries {
  id: string;
  teamAId: string;
  teamBId: string;
  games: SeriesGame[];
  substitutes?: SeriesSubstitute[];
}

export interface MatchWeek {
  id: string;
  weekNumber: number;
  label?: string;
  series: MatchSeries[];
}

export interface AppData {
  ourTeam: Team;
  tournamentTeams: TournamentTeam[];
  players: PlayerProfile[];
  drafts: DraftState[];
  matchWeeks: MatchWeek[];
}

export interface ChampionData {
  id: string;
  name: string;
  key: string;
  title: string;
  tags: string[];
  image: { full: string };
}
