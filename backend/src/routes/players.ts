import { Router, Request, Response } from "express";
import {
  readData,
  upsertPlayer,
  deletePlayer,
  getPlayer,
} from "../services/storage";
import { buildPlayerProfile, refreshPlayerProfile } from "../services/riot";

const router = Router();

// GET /api/players
router.get("/", (_req: Request, res: Response) => {
  const { players } = readData();
  res.json(players);
});

// GET /api/players/:puuid
router.get("/:puuid", (req: Request, res: Response) => {
  const player = getPlayer(req.params.puuid);
  if (!player) return res.status(404).json({ error: "Player not found" });
  return res.json(player);
});

// POST /api/players — add by Riot ID (gameName#tagLine or split)
router.post("/", async (req: Request, res: Response) => {
  try {
    let { gameName, tagLine, riotId, notes } = req.body as {
      gameName?: string;
      tagLine?: string;
      riotId?: string;
      notes?: string;
    };

    if (riotId && riotId.includes("#")) {
      [gameName, tagLine] = riotId.split("#");
    }

    if (!gameName || !tagLine) {
      return res
        .status(400)
        .json({ error: "Provide gameName+tagLine or riotId (name#tag)" });
    }

    const profile = await buildPlayerProfile(gameName, tagLine, notes ?? "");
    upsertPlayer(profile);
    return res.json(profile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// PUT /api/players/:puuid/refresh — accumulate new data from Riot API
router.put("/:puuid/refresh", async (req: Request, res: Response) => {
  const existing = getPlayer(req.params.puuid);
  if (!existing) return res.status(404).json({ error: "Player not found" });

  try {
    const profile = await refreshPlayerProfile(existing);
    upsertPlayer(profile);
    return res.json(profile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// PATCH /api/players/:puuid — update notes / preferred positions
router.patch("/:puuid", (req: Request, res: Response) => {
  const existing = getPlayer(req.params.puuid);
  if (!existing) return res.status(404).json({ error: "Player not found" });

  const { notes, preferredPositions } = req.body as {
    notes?: string;
    preferredPositions?: string[];
  };

  if (notes !== undefined) existing.notes = notes;
  if (preferredPositions !== undefined)
    existing.preferredPositions = preferredPositions as never;

  upsertPlayer(existing);
  return res.json(existing);
});

// POST /api/players/:puuid/lp-history — enrich match records with LP data from Mobalytics
// Body: the full Mobalytics GraphQL response OR just { items: [...] }
router.post("/:puuid/lp-history", (req: Request, res: Response) => {
  const existing = getPlayer(req.params.puuid);
  if (!existing) return res.status(404).json({ error: "Player not found" });

  // Accept either the raw full response or just the items array
  let items: { gameId: number; lp: { lpDiff: number; after: { value: number } } }[];
  try {
    const body = req.body as Record<string, unknown>;
    const raw = (
      (body?.data as Record<string, unknown>)?.lol as Record<string, unknown>
    )?.player as Record<string, unknown>;
    const lpHistory = (raw?.lpHistory ?? body?.lpHistory ?? body) as Record<string, unknown>;
    items = (lpHistory?.items ?? body?.items) as typeof items;
    if (!Array.isArray(items)) throw new Error("no items array found");
  } catch {
    return res.status(400).json({ error: "Could not parse LP history items from body" });
  }

  // Build a lookup: numeric gameId -> { lpDiff, lpAfter }
  const lpMap = new Map<string, { lpDiff: number; lpAfter: number }>();
  for (const item of items) {
    lpMap.set(String(item.gameId), {
      lpDiff: item.lp.lpDiff,
      lpAfter: item.lp.after.value,
    });
  }

  let matched = 0;
  for (const m of existing.matchHistory) {
    // matchId format: "NA1_5656008835" — extract numeric suffix
    const numericId = m.matchId.split("_").pop()!;
    const lp = lpMap.get(numericId);
    if (lp) {
      m.lpDiff = lp.lpDiff;
      m.lpAfter = lp.lpAfter;
      matched++;
    }
  }
  // Keep recentMatches in sync
  existing.recentMatches = existing.matchHistory.slice(0, 20);

  upsertPlayer(existing);
  return res.json({ matched, total: items.length });
});

// DELETE /api/players/:puuid
router.delete("/:puuid", (req: Request, res: Response) => {
  const removed = deletePlayer(req.params.puuid);
  if (!removed) return res.status(404).json({ error: "Player not found" });
  return res.json({ success: true });
});

export default router;
