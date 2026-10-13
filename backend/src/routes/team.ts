import { Router, Request, Response } from "express";
import { getOurTeam, updateOurTeam, readData } from "../services/storage";

const router = Router();

// GET /api/team — our team with full player profiles
router.get("/", (_req: Request, res: Response) => {
  const team = getOurTeam();
  const { players } = readData();
  const teamPlayers = team.players
    .map((puuid) => players.find((p) => p.puuid === puuid))
    .filter(Boolean);
  res.json({ ...team, players: teamPlayers });
});

// PUT /api/team/name
router.put("/name", (req: Request, res: Response) => {
  const { name } = req.body as { name: string };
  if (!name) return res.status(400).json({ error: "name is required" });
  const team = updateOurTeam({ name });
  return res.json(team);
});

// POST /api/team/players — add player to our team
router.post("/players", (req: Request, res: Response) => {
  const { puuid } = req.body as { puuid: string };
  if (!puuid) return res.status(400).json({ error: "puuid is required" });

  const { players } = readData();
  if (!players.find((p) => p.puuid === puuid)) {
    return res
      .status(404)
      .json({ error: "Player not found — add them first via /api/players" });
  }

  const team = getOurTeam();
  if (!team.players.includes(puuid)) {
    team.players.push(puuid);
    updateOurTeam({ players: team.players });
  }
  return res.json(team);
});

// DELETE /api/team/players/:puuid — remove from our team (keeps profile)
router.delete("/players/:puuid", (req: Request, res: Response) => {
  const team = getOurTeam();
  const before = team.players.length;
  team.players = team.players.filter((id) => id !== req.params.puuid);
  if (team.players.length === before) {
    return res
      .status(404)
      .json({ error: "Player not on team" });
  }
  updateOurTeam({ players: team.players });
  return res.json(team);
});

export default router;
