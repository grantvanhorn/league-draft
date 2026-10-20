import { Router, Request, Response } from "express";
import { getRefetchStatus, startRefetch, requestStop } from "../services/refetch";
import { getAllCachedMatchIds } from "../services/matchStore";
import { readData } from "../services/storage";

const router = Router();

// GET /api/refetch/status — includes live disk stats so restarts don't lose visibility
router.get("/status", (_req: Request, res: Response) => {
  const status = getRefetchStatus();
  const cachedOnDisk = getAllCachedMatchIds().size;

  // Compute total unique matchIds from profiles (cheap scan of IDs only)
  let totalMatchIds = status.totalMatchIds;
  if (totalMatchIds === 0) {
    const data = readData();
    const ids = new Set<string>();
    for (const p of data.players) {
      for (const m of p.matchHistory ?? []) ids.add(m.matchId);
    }
    totalMatchIds = ids.size;
  }

  res.json({ ...status, cachedOnDisk, totalMatchIds });
});

// POST /api/refetch/start
router.post("/start", (_req: Request, res: Response) => {
  const s = getRefetchStatus();
  if (s.running) {
    // Return 200 with current status so the client can still render progress
    return res.json({ started: false, status: s });
  }
  // Fire and forget — client polls /status
  startRefetch().catch((err) => {
    console.error("Refetch failed:", err);
  });
  return res.json({ started: true, status: getRefetchStatus() });
});

// POST /api/refetch/stop
router.post("/stop", (_req: Request, res: Response) => {
  requestStop();
  res.json({ stopping: true });
});

export default router;
