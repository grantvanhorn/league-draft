import { Router, Request, Response } from "express";
import { getAccountByRiotId, getMatchIds, getMatch, getMatchTimeline } from "../services/riot";
import { getStoredMatch, saveMatch, getStoredTimeline, saveTimeline } from "../services/matchStore";
import { DeathHeatmapData, DeathEvent, HeatmapGameSummary, MatchTimeline } from "../types";

const router = Router();

// GET /api/death-heatmap/:gameName/:tagLine
// Returns last 10 flex queue deaths with map positions for heatmap rendering.
router.get("/:gameName/:tagLine", async (req: Request, res: Response) => {
  try {
    const { gameName, tagLine } = req.params;

    const account = await getAccountByRiotId(gameName, tagLine);
    const { puuid } = account;

    // Queue 440 = Flex SR
    const matchIds = await getMatchIds(puuid, 10, 440);
    if (matchIds.length === 0) {
      return res.json({ puuid, riotId: `${gameName}#${tagLine}`, deaths: [], games: [] } as DeathHeatmapData);
    }

    const deaths: DeathEvent[] = [];
    const games: HeatmapGameSummary[] = [];

    for (let i = 0; i < matchIds.length; i++) {
      const matchId = matchIds[i];
      const gameIndex = i + 1; // 1 = most recent

      try {
        let match = getStoredMatch(matchId);
        if (!match) { match = await getMatch(matchId); saveMatch(match); }

        let timeline = getStoredTimeline(matchId);
        if (!timeline) { timeline = await getMatchTimeline(matchId); saveTimeline(timeline); }

        const participants = match.info.participants;
        const userParticipant = participants.find((p) => p.puuid === puuid);
        if (!userParticipant) continue;

        // timeline.metadata.participants[0] = participantId 1, etc.
        const userPid = timeline.metadata.participants.indexOf(puuid) + 1;
        if (userPid === 0) continue;

        // participantId (1-indexed) → participant data
        const pidToParticipant = new Map(participants.map((p, idx) => [idx + 1, p]));

        let gameDeathCount = 0;

        for (const frame of timeline.info.frames) {
          for (const raw of frame.events) {
            if (raw.type !== "CHAMPION_KILL") continue;

            const ev = raw as {
              type: string;
              timestamp: number;
              position: { x: number; y: number };
              killerId: number;
              victimId: number;
              assistingParticipantIds?: number[];
            };

            if (ev.victimId !== userPid) continue;

            const killer = ev.killerId > 0 ? pidToParticipant.get(ev.killerId) : null;
            const assistingChampions = (ev.assistingParticipantIds ?? [])
              .map((pid) => pidToParticipant.get(pid)?.championName ?? "Unknown");

            deaths.push({
              matchId,
              gameDate: match.info.gameStartTimestamp,
              gameIndex,
              timestamp: ev.timestamp,
              position: ev.position,
              killerChampion: killer?.championName ?? null,
              killerName: killer?.summonerName ?? null,
              assistingChampions,
              victimChampion: userParticipant.championName,
              win: userParticipant.win,
            });
            gameDeathCount++;
          }
        }

        games.push({
          matchId,
          gameDate: match.info.gameStartTimestamp,
          gameIndex,
          champion: userParticipant.championName,
          win: userParticipant.win,
          deathCount: gameDeathCount,
        });
      } catch (err) {
        console.error(`[death-heatmap] failed to process ${matchId}:`, err);
      }
    }

    return res.json({ puuid, riotId: `${gameName}#${tagLine}`, deaths, games } as DeathHeatmapData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

export default router;
