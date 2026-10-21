import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getMatchWeeks, getMatchWeek, upsertMatchWeek } from "../services/storage";
import { getMatch } from "../services/riot";
import { getStoredMatch, saveMatch } from "../services/matchStore";
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

// GET /api/match-history/tournament-ids
// Returns all matchIds across every series in every week
router.get("/tournament-ids", (_req: Request, res: Response) => {
  const weeks = getMatchWeeks();
  const ids = weeks.flatMap((w) => w.series.flatMap((s) => s.games.map((g) => g.matchId)));
  res.json(ids);
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

// PATCH /api/match-history/weeks/:weekId/series/:seriesId/games
// Body: { games: [{ gameNumber, matchId }] } — replaces game list (clears fetchedAt/data)
router.patch("/weeks/:weekId/series/:seriesId/games", (req: Request, res: Response) => {
  const week = getMatchWeek(req.params.weekId);
  if (!week) return res.status(404).json({ error: "Week not found" });

  const series = week.series.find((s) => s.id === req.params.seriesId);
  if (!series) return res.status(404).json({ error: "Series not found" });

  const { games } = req.body as { games: { gameNumber: number; matchId: string }[] };
  if (!Array.isArray(games) || games.length === 0) return res.status(400).json({ error: "games must be a non-empty array" });

  series.games = games.map((g) => ({ gameNumber: g.gameNumber, matchId: g.matchId }));
  upsertMatchWeek(week);
  return res.json(series);
});

// PATCH /api/match-history/weeks/:weekId/series/:seriesId/substitutes
// Body: { substitutes: [{ riotIdGameName, replacingRiotId, teamId }] }
router.patch("/weeks/:weekId/series/:seriesId/substitutes", (req: Request, res: Response) => {
  const week = getMatchWeek(req.params.weekId);
  if (!week) return res.status(404).json({ error: "Week not found" });

  const series = week.series.find((s) => s.id === req.params.seriesId);
  if (!series) return res.status(404).json({ error: "Series not found" });

  const { substitutes } = req.body as { substitutes: { riotIdGameName: string; replacingRiotId: string; teamId: string }[] };
  if (!Array.isArray(substitutes)) return res.status(400).json({ error: "substitutes must be an array" });

  series.substitutes = substitutes;
  upsertMatchWeek(week);
  return res.json(series);
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
        // Check disk cache before hitting Riot API
        const cached = getStoredMatch(game.matchId);
        let data;
        if (cached) {
          data = cached;
        } else {
          data = await getMatch(game.matchId);
          saveMatch(data);
        }
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
