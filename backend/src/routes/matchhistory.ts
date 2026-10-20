import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getMatchWeeks, getMatchWeek, upsertMatchWeek } from "../services/storage";
import { getMatch } from "../services/riot";
import { MatchWeek, MatchSeries, SeriesGame } from "../types";

const router = Router();

// GET /api/match-history/weeks
router.get("/weeks", (_req: Request, res: Response) => {
  const weeks = getMatchWeeks().map((w) => ({
    id: w.id,
    weekNumber: w.weekNumber,
    label: w.label,
    seriesCount: w.series.length,
    fetchedCount: w.series.reduce(
      (acc, s) => acc + s.games.filter((g) => g.fetchedAt).length,
      0
    ),
    totalGames: w.series.reduce((acc, s) => acc + s.games.length, 0),
  }));
  res.json(weeks);
});

// GET /api/match-history/weeks/:weekId
router.get("/weeks/:weekId", (req: Request, res: Response) => {
  const week = getMatchWeek(req.params.weekId);
  if (!week) return res.status(404).json({ error: "Week not found" });
  return res.json(week);
});

// POST /api/match-history/weeks
// Body: { weekNumber: number, label?: string, series: [{ teamAId, teamBId, games: [{ gameNumber, matchId }] }] }
router.post("/weeks", (req: Request, res: Response) => {
  const { weekNumber, label, series } = req.body as {
    weekNumber: number;
    label?: string;
    series: { teamAId: string; teamBId: string; games: { gameNumber: number; matchId: string }[] }[];
  };

  if (!weekNumber || !Array.isArray(series)) {
    return res.status(400).json({ error: "weekNumber and series are required" });
  }

  const existing = getMatchWeeks().find((w) => w.weekNumber === weekNumber);
  if (existing) {
    return res.status(409).json({ error: `Week ${weekNumber} already exists (id: ${existing.id})` });
  }

  const weekId = `week-${weekNumber}`;
  const week: MatchWeek = {
    id: weekId,
    weekNumber,
    label,
    series: series.map((s) => ({
      id: `${weekId}-${s.teamAId}-${s.teamBId}`,
      teamAId: s.teamAId,
      teamBId: s.teamBId,
      games: s.games.map((g) => ({
        gameNumber: g.gameNumber,
        matchId: g.matchId,
      })),
    })),
  };

  upsertMatchWeek(week);
  return res.status(201).json(week);
});

// POST /api/match-history/weeks/:weekId/fetch
// Fetches Riot data for all unfetched games in the week
router.post("/weeks/:weekId/fetch", async (req: Request, res: Response) => {
  const week = getMatchWeek(req.params.weekId);
  if (!week) return res.status(404).json({ error: "Week not found" });

  const errors: { matchId: string; error: string }[] = [];

  for (const series of week.series) {
    for (const game of series.games) {
      if (game.fetchedAt) continue; // already cached
      try {
        const data = await getMatch(game.matchId);
        game.data = data;
        game.fetchedAt = new Date().toISOString();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ matchId: game.matchId, error: msg });
      }
    }
  }

  upsertMatchWeek(week);
  return res.json({ week, errors });
});

export default router;
