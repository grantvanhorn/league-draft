import { Router, Request, Response } from "express";
import {
  getTournamentTeams,
  getTournamentTeam,
  setTournamentTeams,
  readData,
} from "../services/storage";
import { seedTournamentTeams } from "../data/tournament-seed";
import { getImportStatus, isImportRunning, startImport, startDeepImport, startDeepImportForPlayers, retryFailed, startRefresh } from "../services/importer";

const router = Router();

// GET /api/tournament/teams
router.get("/teams", (_req: Request, res: Response) => {
  const teams = getTournamentTeams();
  const { players } = readData();

  // Hydrate roster entries with player profiles
  const hydrated = teams.map((team) => ({
    ...team,
    roster: team.roster.map((entry) => ({
      ...entry,
      profile: entry.puuid
        ? players.find((p) => p.puuid === entry.puuid) ?? null
        : null,
    })),
  }));

  res.json(hydrated);
});

// GET /api/tournament/teams/:id
router.get("/teams/:id", (req: Request, res: Response) => {
  const team = getTournamentTeam(req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const { players } = readData();
  const hydrated = {
    ...team,
    roster: team.roster.map((entry) => ({
      ...entry,
      profile: entry.puuid
        ? players.find((p) => p.puuid === entry.puuid) ?? null
        : null,
    })),
  };
  return res.json(hydrated);
});

// POST /api/tournament/seed — load team structure (no Riot API calls)
router.post("/seed", (_req: Request, res: Response) => {
  const data = readData();
  const seeded = seedTournamentTeams();

  // Preserve any already-linked puuids
  const existing = new Map(
    (data.tournamentTeams ?? []).flatMap((t) =>
      t.roster.map((r) => [`${t.id}:${r.riotId.toLowerCase()}`, r.puuid])
    )
  );

  for (const team of seeded) {
    for (const entry of team.roster) {
      const key = `${team.id}:${entry.riotId.toLowerCase()}`;
      entry.puuid = existing.get(key) ?? null;
    }
  }

  setTournamentTeams(seeded);
  res.json({ message: `Seeded ${seeded.length} teams`, teams: seeded });
});

// POST /api/tournament/import — kick off bulk player import
router.post("/import", async (_req: Request, res: Response) => {
  if (isImportRunning()) {
    return res.status(409).json({ error: "Import already running", status: getImportStatus() });
  }

  const teams = getTournamentTeams();
  if (teams.length === 0) {
    return res.status(400).json({ error: "Seed teams first via POST /api/tournament/seed" });
  }

  try {
    await startImport();
    return res.json({ message: "Import started", status: getImportStatus() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// GET /api/tournament/import/status
router.get("/import/status", (_req: Request, res: Response) => {
  res.json(getImportStatus());
});

// POST /api/tournament/import/retry — re-import only players with null puuid
router.post("/import/retry", async (_req: Request, res: Response) => {
  if (isImportRunning()) {
    return res.status(409).json({ error: "Import already running" });
  }
  try {
    await retryFailed();
    return res.json({ message: "Retry started", status: getImportStatus() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: msg });
  }
});

// POST /api/tournament/import/players — force-rebuild specific players by riotId
router.post("/import/players", async (req: Request, res: Response) => {
  if (isImportRunning()) {
    return res.status(409).json({ error: "Already running", status: getImportStatus() });
  }
  const { riotIds } = req.body as { riotIds?: string[] };
  if (!Array.isArray(riotIds) || riotIds.length === 0) {
    return res.status(400).json({ error: "Provide riotIds array in body" });
  }
  try {
    await startDeepImportForPlayers(riotIds);
    return res.json({ message: `Started deep import for ${riotIds.length} players`, status: getImportStatus() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// POST /api/tournament/import/deep — force-rebuild all profiles with full history
router.post("/import/deep", async (_req: Request, res: Response) => {
  if (isImportRunning()) {
    return res.status(409).json({ error: "Already running", status: getImportStatus() });
  }
  try {
    await startDeepImport();
    return res.json({ message: "Deep import started", status: getImportStatus() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// POST /api/tournament/refresh — re-fetch & accumulate data for all imported players
router.post("/refresh", async (_req: Request, res: Response) => {
  if (isImportRunning()) {
    return res.status(409).json({ error: "Already running", status: getImportStatus() });
  }
  try {
    await startRefresh();
    return res.json({ message: "Refresh started", status: getImportStatus() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

export default router;
