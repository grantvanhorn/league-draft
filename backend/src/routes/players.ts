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

// POST /api/players/:puuid/import — enrich match records from an external data file.
// Accepts Mobalytics GraphQL responses or op.gg exports (auto-detected).
// All formats share the numeric gameId which maps to our matchId via "NA1_{gameId}".
router.post("/:puuid/import", (req: Request, res: Response) => {
  const existing = getPlayer(req.params.puuid);
  if (!existing) return res.status(404).json({ error: "Player not found" });

  const body = req.body as Record<string, unknown>;
  const result = parseExternalData(body);
  if (!result) {
    return res.status(400).json({
      error: "Unrecognized format. Expected Mobalytics GraphQL response or op.gg export.",
    });
  }

  let matched = 0;
  for (const m of existing.matchHistory) {
    const numericId = m.matchId.split("_").pop()!;
    const ext = result.get(numericId);
    if (!ext) continue;
    if (ext.lpDiff !== undefined) m.lpDiff = ext.lpDiff;
    if (ext.lpAfter !== undefined) m.lpAfter = ext.lpAfter;
    matched++;
  }

  existing.recentMatches = existing.matchHistory.slice(0, 20);
  upsertPlayer(existing);
  return res.json({ source: result.source, matched, totalGames: result.size });
});


interface ExtEnrichedGame {
  lpDiff?: number;
  lpAfter?: number;
}

interface ParsedExternal extends Map<string, ExtEnrichedGame> {
  source: string;
}

function parseExternalData(body: Record<string, unknown>): ParsedExternal | null {
  // ── Mobalytics: full GraphQL response or extracted lpHistory ──
  const mobaPlayer = (
    (body?.data as Record<string, unknown>)?.lol as Record<string, unknown>
  )?.player as Record<string, unknown> | undefined;

  const lpHistory = (
    mobaPlayer?.lpHistory ?? body?.lpHistory ?? body
  ) as Record<string, unknown> | undefined;

  const items = lpHistory?.items ?? body?.items;
  if (Array.isArray(items) && items.length > 0 && "gameId" in (items[0] as object)) {
    const map = new Map() as ParsedExternal;
    map.source = "mobalytics";
    for (const item of items as { gameId: number; lp?: { lpDiff: number; after: { value: number } } }[]) {
      const entry: ExtEnrichedGame = {};
      if (item.lp) {
        entry.lpDiff = item.lp.lpDiff;
        entry.lpAfter = item.lp.after.value;
      }
      map.set(String(item.gameId), entry);
    }
    return map;
  }

  // ── op.gg: array of game objects with game_id or gameId ──
  const games = body?.data ?? body?.games ?? body;
  if (Array.isArray(games) && games.length > 0) {
    const first = games[0] as Record<string, unknown>;
    const idField = "game_id" in first ? "game_id" : "gameId" in first ? "gameId" : null;
    if (idField) {
      const map = new Map() as ParsedExternal;
      map.source = "opgg";
      for (const g of games as Record<string, unknown>[]) {
        const rawId = String(g[idField]).replace(/^[A-Z0-9]+_/i, "");
        map.set(rawId, {});
      }
      return map;
    }
  }

  return null;
}

// DELETE /api/players/:puuid
router.delete("/:puuid", (req: Request, res: Response) => {
  const removed = deletePlayer(req.params.puuid);
  if (!removed) return res.status(404).json({ error: "Player not found" });
  return res.json({ success: true });
});

export default router;
