import { buildPlayerProfile, refreshPlayerProfile } from "./riot";
import {
  readData,
  writeData,
  findPlayerByRiotId,
  upsertPlayer,
} from "./storage";
import { ImportStatus } from "../types";

let importStatus: ImportStatus = {
  running: false,
  total: 0,
  completed: 0,
  current: null,
  failed: [],
  startedAt: null,
  finishedAt: null,
};

export function getImportStatus(): ImportStatus {
  return { ...importStatus };
}

export function isImportRunning(): boolean {
  return importStatus.running;
}

function buildQueue(onlyMissing = false): { riotId: string; teamId: string }[] {
  const data = readData();
  const seen = new Set<string>();
  const queue: { riotId: string; teamId: string }[] = [];

  for (const team of data.tournamentTeams) {
    for (const entry of team.roster) {
      const key = entry.riotId.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (onlyMissing && entry.puuid !== null) continue;
      queue.push({ riotId: entry.riotId, teamId: team.id });
    }
  }
  return queue;
}

export async function startImport(): Promise<void> {
  if (importStatus.running) return;

  const data = readData();
  if (!data.tournamentTeams || data.tournamentTeams.length === 0) {
    throw new Error("No tournament teams seeded. Call /api/tournament/seed first.");
  }

  const queue = buildQueue(false);

  importStatus = {
    running: true,
    total: queue.length,
    completed: 0,
    current: null,
    failed: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  processQueue(queue, false).catch(console.error);
}

// Force-rebuild every profile from scratch — use this to get full deep history.
export async function startDeepImport(): Promise<void> {
  if (importStatus.running) return;

  const data = readData();
  if (!data.tournamentTeams || data.tournamentTeams.length === 0) {
    throw new Error("No tournament teams seeded. Call /api/tournament/seed first.");
  }

  const queue = buildQueue(false);

  importStatus = {
    running: true,
    total: queue.length,
    completed: 0,
    current: null,
    failed: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  processQueue(queue, true).catch(console.error);
}

export async function startDeepImportForPlayers(riotIds: string[]): Promise<void> {
  if (importStatus.running) return;

  const data = readData();
  const riotIdSet = new Set(riotIds.map((r) => r.toLowerCase()));
  const seen = new Set<string>();
  const queue: { riotId: string; teamId: string }[] = [];

  for (const team of data.tournamentTeams) {
    for (const entry of team.roster) {
      const key = entry.riotId.toLowerCase();
      if (!riotIdSet.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ riotId: entry.riotId, teamId: team.id });
    }
  }

  if (queue.length === 0) throw new Error("None of the specified riotIds found in tournament teams");

  importStatus = {
    running: true,
    total: queue.length,
    completed: 0,
    current: null,
    failed: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  processQueue(queue, true).catch(console.error);
}

export async function startRefresh(): Promise<void> {
  if (importStatus.running) return;

  const data = readData();
  if (!data.tournamentTeams || data.tournamentTeams.length === 0) {
    throw new Error("No tournament teams seeded.");
  }

  // Refresh all players that already have a profile
  const seen = new Set<string>();
  const queue: { riotId: string; teamId: string }[] = [];
  for (const team of data.tournamentTeams) {
    for (const entry of team.roster) {
      const key = entry.riotId.toLowerCase();
      if (seen.has(key) || !entry.puuid) continue;
      seen.add(key);
      queue.push({ riotId: entry.riotId, teamId: team.id });
    }
  }

  importStatus = {
    running: true,
    total: queue.length,
    completed: 0,
    current: null,
    failed: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  processRefreshQueue(queue).catch(console.error);
}

export async function retryFailed(): Promise<void> {
  if (importStatus.running) return;

  const queue = buildQueue(true);
  if (queue.length === 0) throw new Error("No missing players to retry");

  importStatus = {
    running: true,
    total: queue.length,
    completed: 0,
    current: null,
    failed: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  processQueue(queue).catch(console.error);
}

async function processRefreshQueue(
  queue: { riotId: string; teamId: string }[]
): Promise<void> {
  for (const { riotId } of queue) {
    importStatus.current = riotId;
    try {
      const existing = findPlayerByRiotId(riotId);
      if (!existing) {
        importStatus.failed.push({ riotId, error: "Profile not found — run import first" });
      } else {
        const updated = await refreshPlayerProfile(existing);
        upsertPlayer(updated);
      }
    } catch (err) {
      importStatus.failed.push({
        riotId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    importStatus.completed++;
  }
  importStatus.running = false;
  importStatus.current = null;
  importStatus.finishedAt = new Date().toISOString();
  console.log(
    `Refresh complete. ${importStatus.completed - importStatus.failed.length}/${importStatus.total} succeeded.`,
    importStatus.failed.length > 0 ? `Failed: ${importStatus.failed.map((f) => f.riotId).join(", ")}` : ""
  );
}

async function processQueue(
  queue: { riotId: string; teamId: string }[],
  force = false
): Promise<void> {
  for (const { riotId, teamId } of queue) {
    importStatus.current = riotId;

    try {
      let profile = force ? null : findPlayerByRiotId(riotId);

      if (!profile) {
        const hashIdx = riotId.indexOf("#");
        if (hashIdx < 0) throw new Error("Invalid riotId format");
        const gameName = riotId.slice(0, hashIdx).trim();
        const tagLine = riotId.slice(hashIdx + 1).trim();
        const existingNotes = findPlayerByRiotId(riotId)?.notes ?? "";
        profile = await buildPlayerProfile(gameName, tagLine, existingNotes);
        upsertPlayer(profile);
      }

      // Link puuid back into the tournament team roster
      const fresh = readData();
      const team = fresh.tournamentTeams.find((t) => t.id === teamId);
      if (team) {
        const entry = team.roster.find(
          (r) => r.riotId.toLowerCase() === riotId.toLowerCase()
        );
        if (entry) entry.puuid = profile!.puuid;
      }

      // Auto-add CT players to ourTeam
      const ourTeamEntry = fresh.tournamentTeams.find((t) => t.isOurTeam);
      if (
        ourTeamEntry?.roster.some(
          (r) => r.riotId.toLowerCase() === riotId.toLowerCase()
        ) &&
        !fresh.ourTeam.players.includes(profile!.puuid)
      ) {
        fresh.ourTeam.players.push(profile!.puuid);
        fresh.ourTeam.name = ourTeamEntry.name;
      }

      writeData(fresh);
    } catch (err) {
      importStatus.failed.push({
        riotId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    importStatus.completed++;
  }

  importStatus.running = false;
  importStatus.current = null;
  importStatus.finishedAt = new Date().toISOString();
  console.log(
    `Import complete. ${importStatus.completed - importStatus.failed.length}/${importStatus.total} succeeded.`,
    importStatus.failed.length > 0 ? `Failed: ${importStatus.failed.map((f) => f.riotId).join(", ")}` : ""
  );
}
