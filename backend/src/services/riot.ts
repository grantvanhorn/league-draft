import axios from "axios";
import {
  RiotAccount,
  Summoner,
  RankedEntry,
  ChampionMastery,
  Match,
  MatchRecord,
  PlayerProfile,
  Position,
} from "../types";
import { hasMatch, getStoredMatch, saveMatch, deriveMatchRecord } from "./matchStore";

const PLATFORM = "na1";
const REGION = "americas";
const DD_VERSION_URL = "https://ddragon.leagueoflegends.com/api/versions.json";

// Sliding window rate limiter: stay under 95 req/2min (dev key = 100/2min)
class RateLimiter {
  private perSecTs: number[] = [];
  private perTwoMinTs: number[] = [];

  async wait(): Promise<void> {
    // Enforce both windows in a loop — a single pass can satisfy one but not the other
    while (true) {
      const now = Date.now();
      this.perSecTs = this.perSecTs.filter((t) => now - t < 1_000);
      this.perTwoMinTs = this.perTwoMinTs.filter((t) => now - t < 120_000);

      if (this.perSecTs.length >= 19) {
        const waitMs = this.perSecTs[0] + 1_000 - Date.now() + 10;
        if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      if (this.perTwoMinTs.length >= 95) {
        const waitMs = this.perTwoMinTs[0] + 120_000 - Date.now() + 250;
        if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      break;
    }
    const ts = Date.now();
    this.perSecTs.push(ts);
    this.perTwoMinTs.push(ts);
  }
}

const rateLimiter = new RateLimiter();

async function riotFetch<T>(url: string, retries = 4): Promise<T> {
  await rateLimiter.wait();
  try {
    const res = await axios.get<T>(url, {
      headers: { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" },
    });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const status = err.response.status;
      if (status === 429 && retries > 0) {
        const retryAfter = Number(err.response.headers["retry-after"] ?? 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000 + 250));
        return riotFetch<T>(url, retries - 1);
      }
      throw new Error(`Riot API ${status}: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

export async function getAccountByRiotId(
  gameName: string,
  tagLine: string
): Promise<RiotAccount> {
  return riotFetch<RiotAccount>(
    `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
}

export async function getSummonerByPuuid(puuid: string): Promise<Summoner> {
  return riotFetch<Summoner>(
    `https://${PLATFORM}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`
  );
}

export async function getRankedEntries(
  puuid: string
): Promise<RankedEntry[]> {
  return riotFetch<RankedEntry[]>(
    `https://${PLATFORM}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`
  );
}

export async function getChampionMasteries(
  puuid: string,
  count = 10
): Promise<ChampionMastery[]> {
  return riotFetch<ChampionMastery[]>(
    `https://${PLATFORM}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`
  );
}

export async function getMatchIds(
  puuid: string,
  count = 20,
  queue?: number,
  start = 0
): Promise<string[]> {
  const params = new URLSearchParams({ count: String(count), start: String(start) });
  if (queue) params.set("queue", String(queue));
  return riotFetch<string[]>(
    `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?${params}`
  );
}

// Fetches up to maxTotal match IDs by paging 100 at a time.
export async function getAllMatchIds(
  puuid: string,
  maxTotal = 500
): Promise<string[]> {
  const PAGE_SIZE = 100;
  const ids: string[] = [];
  let start = 0;
  while (ids.length < maxTotal) {
    const batch = await getMatchIds(puuid, PAGE_SIZE, undefined, start);
    ids.push(...batch);
    if (batch.length < PAGE_SIZE) break; // no more history
    start += PAGE_SIZE;
  }
  return ids.slice(0, maxTotal);
}

export async function getMatch(matchId: string): Promise<Match> {
  return riotFetch<Match>(
    `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`
  );
}

let ddVersionCache: string | null = null;
let championMapCache: Record<string, string> | null = null;

async function getDDVersion(): Promise<string> {
  if (ddVersionCache) return ddVersionCache;
  const { data } = await axios.get<string[]>(DD_VERSION_URL);
  ddVersionCache = data[0];
  return ddVersionCache;
}

export async function getChampionIdNameMap(): Promise<Record<string, string>> {
  if (championMapCache) return championMapCache;
  const version = await getDDVersion();
  const { data } = await axios.get<{ data: Record<string, { key: string; name: string }> }>(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );
  const map: Record<string, string> = {};
  for (const champ of Object.values(data.data)) {
    map[champ.key] = champ.name;
  }
  championMapCache = map;
  return map;
}

export async function getLatestDDVersion(): Promise<string> {
  return getDDVersion();
}

function inferPositions(
  matches: PlayerProfile["recentMatches"]
): Position[] {
  const counts: Record<string, number> = {};
  for (const m of matches) {
    const role = m.role?.toUpperCase() ?? "";
    if (role) counts[role] = (counts[role] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([r]) => r as Position);
}

async function fetchMatchRecords(puuid: string, matchIds: string[]): Promise<MatchRecord[]> {
  const records: MatchRecord[] = [];
  for (const id of matchIds) {
    let match: Match;
    try {
      // Use cached raw match if available, otherwise fetch and cache
      const cached = getStoredMatch(id);
      if (cached) {
        match = cached;
      } else {
        match = await getMatch(id);
        saveMatch(match);
      }
    } catch {
      continue;
    }
    const record = deriveMatchRecord(match, puuid);
    if (record) records.push(record);
  }
  return records;
}

export async function buildPlayerProfile(
  gameName: string,
  tagLine: string,
  existingNotes = "",
  options: { matchCount?: number; deepHistory?: boolean } = {}
): Promise<PlayerProfile> {
  const account = await getAccountByRiotId(gameName, tagLine);
  const summoner = await getSummonerByPuuid(account.puuid);
  const [rankedEntries, masteries, champMap] = await Promise.all([
    getRankedEntries(account.puuid),
    getChampionMasteries(account.puuid, 15),
    getChampionIdNameMap(),
  ]);

  // Deep history pass: page through all available matches (up to 500).
  // Incremental refreshes will only fetch new IDs on top of this.
  const allIds = await getAllMatchIds(account.puuid, options.matchCount ?? 500);

  const soloQueue = rankedEntries.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null;
  const flexQueue = rankedEntries.find((e) => e.queueType === "RANKED_FLEX_SR") ?? null;

  const topChampions = masteries.map((m) => ({
    championId: m.championId,
    championName: champMap[String(m.championId)] ?? String(m.championId),
    championPoints: m.championPoints,
    level: m.championLevel,
  }));

  const matchHistory = await fetchMatchRecords(account.puuid, allIds);
  matchHistory.sort((a, b) => b.gameDate - a.gameDate);
  const recentMatches = matchHistory.slice(0, 20);
  const preferredPositions = inferPositions(recentMatches);
  const now = new Date().toISOString();

  return {
    puuid: account.puuid,
    riotId: `${gameName}#${tagLine}`,
    gameName,
    tagLine,
    summonerId: account.puuid,
    summonerLevel: summoner.summonerLevel,
    profileIconId: summoner.profileIconId,
    ranked: { soloQueue, flexQueue },
    topChampions,
    recentMatches,
    matchHistory,
    rankedHistory: [{ timestamp: now, soloQueue, flexQueue }],
    preferredPositions,
    notes: existingNotes,
    lastUpdated: now,
  };
}

export async function refreshPlayerProfile(existing: PlayerProfile): Promise<PlayerProfile> {
  const account = await getAccountByRiotId(existing.gameName, existing.tagLine);
  const summoner = await getSummonerByPuuid(account.puuid);
  const [rankedEntries, masteries, champMap] = await Promise.all([
    getRankedEntries(account.puuid),
    getChampionMasteries(account.puuid, 15),
    getChampionIdNameMap(),
  ]);

  const soloQueue = rankedEntries.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null;
  const flexQueue = rankedEntries.find((e) => e.queueType === "RANKED_FLEX_SR") ?? null;

  // Only fetch match details we don't already have — page until we stop seeing new IDs.
  const knownIds = new Set((existing.matchHistory ?? existing.recentMatches).map((m) => m.matchId));
  const PAGE_SIZE = 100;
  let start = 0;
  const newIds: string[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await getMatchIds(account.puuid, PAGE_SIZE, undefined, start);
    const unseen = page.filter((id) => !knownIds.has(id));
    newIds.push(...unseen);
    // If the whole page is already known, we've caught up
    if (unseen.length < page.length || page.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  const newRecords = await fetchMatchRecords(account.puuid, newIds);

  // Merge: prepend newest, keep existing, deduplicate
  const merged = [...newRecords, ...(existing.matchHistory ?? existing.recentMatches)];
  const seen = new Set<string>();
  const matchHistory = merged.filter((m) => {
    if (seen.has(m.matchId)) return false;
    seen.add(m.matchId);
    return true;
  }).sort((a, b) => b.gameDate - a.gameDate);

  // Accumulate rank snapshots only when rank changes
  const rankedHistory = [...(existing.rankedHistory ?? [])];
  const last = rankedHistory[rankedHistory.length - 1];
  const soloChanged = JSON.stringify(last?.soloQueue) !== JSON.stringify(soloQueue);
  const flexChanged = JSON.stringify(last?.flexQueue) !== JSON.stringify(flexQueue);
  if (!last || soloChanged || flexChanged) {
    rankedHistory.push({ timestamp: new Date().toISOString(), soloQueue, flexQueue });
  }

  const topChampions = masteries.map((m) => ({
    championId: m.championId,
    championName: champMap[String(m.championId)] ?? String(m.championId),
    championPoints: m.championPoints,
    level: m.championLevel,
  }));

  const recentMatches = matchHistory.slice(0, 20);
  const preferredPositions = inferPositions(recentMatches);

  return {
    ...existing,
    summonerLevel: summoner.summonerLevel,
    profileIconId: summoner.profileIconId,
    ranked: { soloQueue, flexQueue },
    topChampions,
    recentMatches,
    matchHistory,
    rankedHistory,
    preferredPositions,
    lastUpdated: new Date().toISOString(),
  };
}
