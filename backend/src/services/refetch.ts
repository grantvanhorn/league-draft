import { readData, writeData } from "./storage";
import { getMatch } from "./riot";
import { hasMatch, saveMatch, getAllCachedMatchIds, getStoredMatch, deriveMatchRecord } from "./matchStore";
import { RefetchStatus } from "../types";

let status: RefetchStatus = {
  running: false,
  phase: "idle",
  totalMatchIds: 0,
  alreadyCached: 0,
  fetchedCount: 0,
  failedCount: 0,
  rederivingPlayer: null,
  currentMatchId: null,
  errors: [],
  startedAt: null,
  finishedAt: null,
};

let stopRequested = false;

export function getRefetchStatus(): RefetchStatus {
  return { ...status };
}

export function requestStop(): void {
  stopRequested = true;
}

export async function startRefetch(): Promise<void> {
  if (status.running) return;
  stopRequested = false;

  const data = readData();

  // Collect all unique matchIds across all players
  const allMatchIds = new Set<string>();
  for (const player of data.players) {
    for (const m of player.matchHistory ?? []) {
      allMatchIds.add(m.matchId);
    }
  }

  const cached = getAllCachedMatchIds();
  const toFetch = [...allMatchIds].filter((id) => !cached.has(id));

  status = {
    running: true,
    phase: "fetching",
    totalMatchIds: allMatchIds.size,
    alreadyCached: cached.size < allMatchIds.size ? allMatchIds.size - toFetch.length : allMatchIds.size,
    fetchedCount: 0,
    failedCount: 0,
    rederivingPlayer: null,
    currentMatchId: null,
    errors: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  // Phase 1: fetch raw match data for everything not already stored
  for (const matchId of toFetch) {
    if (stopRequested) {
      status.running = false;
      status.phase = "stopped";
      status.finishedAt = new Date().toISOString();
      return;
    }

    status.currentMatchId = matchId;
    try {
      const match = await getMatch(matchId);
      saveMatch(match);
      status.fetchedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      status.errors.push({ matchId, error: msg });
      status.failedCount++;
    }
  }

  // Phase 2: re-derive all MatchRecords from stored raw data
  status.phase = "rederiving";
  status.currentMatchId = null;

  const freshData = readData();
  for (const player of freshData.players) {
    if (stopRequested) break;
    status.rederivingPlayer = player.riotId;

    const newHistory = [];
    for (const existing of player.matchHistory ?? []) {
      const raw = getStoredMatch(existing.matchId);
      if (raw) {
        const derived = deriveMatchRecord(raw, player.puuid);
        if (derived) {
          // Preserve manually-enriched LP data
          derived.lpDiff = existing.lpDiff;
          derived.lpAfter = existing.lpAfter;
          newHistory.push(derived);
          continue;
        }
      }
      // Raw match unavailable (fetch failed) — keep existing record unchanged
      newHistory.push(existing);
    }

    player.matchHistory = newHistory.sort((a, b) => b.gameDate - a.gameDate);
    player.recentMatches = player.matchHistory.slice(0, 20);
  }

  writeData(freshData);

  status.running = false;
  status.phase = stopRequested ? "stopped" : "done";
  status.rederivingPlayer = null;
  status.finishedAt = new Date().toISOString();
}
