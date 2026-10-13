import axios from "axios";
import { Router, Request, Response } from "express";
import { getLatestDDVersion } from "../services/riot";

const router = Router();

let champCache: unknown = null;
let cacheVersion: string | null = null;

// GET /api/champions
router.get("/", async (_req: Request, res: Response) => {
  try {
    const version = await getLatestDDVersion();
    if (champCache && cacheVersion === version) {
      return res.json(champCache);
    }

    const { data } = await axios.get<{ data: Record<string, unknown> }>(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
    );
    const champions = Object.values(data.data);
    champCache = champions;
    cacheVersion = version;
    return res.json(champions);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// GET /api/champions/version
router.get("/version", async (_req: Request, res: Response) => {
  try {
    const version = await getLatestDDVersion();
    return res.json({ version });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

export default router;
