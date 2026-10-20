import fs from "fs";
import path from "path";
import { Match, MatchRecord, MatchParticipant } from "../types";

const MATCHES_DIR = path.join(__dirname, "../../data/matches");

function ensureDir() {
  if (!fs.existsSync(MATCHES_DIR)) fs.mkdirSync(MATCHES_DIR, { recursive: true });
}

function matchPath(matchId: string): string {
  return path.join(MATCHES_DIR, `${matchId}.json`);
}

export function hasMatch(matchId: string): boolean {
  return fs.existsSync(matchPath(matchId));
}

export function getStoredMatch(matchId: string): Match | null {
  const p = matchPath(matchId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as Match;
  } catch {
    return null;
  }
}

export function saveMatch(match: Match): void {
  ensureDir();
  fs.writeFileSync(matchPath(match.metadata.matchId), JSON.stringify(match));
}

export function getAllCachedMatchIds(): Set<string> {
  ensureDir();
  const files = fs.readdirSync(MATCHES_DIR);
  const ids = new Set<string>();
  for (const f of files) {
    if (f.endsWith(".json")) ids.add(f.slice(0, -5));
  }
  return ids;
}

// ─── Role derivation ──────────────────────────────────────────────────────────

export function deriveRole(p: MatchParticipant, allParticipants: MatchParticipant[]): string {
  // UTILITY is unambiguous — Riot only uses it for actual support
  if (p.teamPosition === "UTILITY") return "UTILITY";
  // Non-BOTTOM positions (TOP, JUNGLE, MIDDLE) are reliable
  if (p.teamPosition && p.teamPosition !== "BOTTOM") return p.teamPosition;

  // For BOTTOM: use Riot's role field first (DUO_SUPPORT / DUO_CARRY)
  if (p.role === "DUO_SUPPORT") return "UTILITY";
  if (p.role === "DUO_CARRY") return "BOTTOM";

  // Relative CS: the player with fewer CS in the bot lane duo is the support
  const myCS = (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0);
  const botMate = allParticipants.find(
    (t) => t.puuid !== p.puuid && t.teamId === p.teamId && t.teamPosition === "BOTTOM"
  );
  if (botMate) {
    const mateCS = (botMate.totalMinionsKilled ?? 0) + (botMate.neutralMinionsKilled ?? 0);
    return myCS <= mateCS ? "UTILITY" : "BOTTOM";
  }

  // Fallback: use lane
  return p.lane !== "NONE" ? p.lane : "";
}

export function deriveMatchRecord(match: Match, puuid: string): MatchRecord | null {
  const p = match.info.participants.find((x) => x.puuid === puuid);
  if (!p) return null;
  const duration = match.info.gameDuration;
  const cs = (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0);
  return {
    matchId: match.metadata.matchId,
    championName: p.championName,
    win: p.win,
    kda: { kills: p.kills, deaths: p.deaths, assists: p.assists },
    role: deriveRole(p, match.info.participants),
    gameDate: match.info.gameStartTimestamp,
    gameDuration: duration,
    cs,
    csPerMin: duration > 0 ? Math.round((cs / duration) * 60 * 10) / 10 : 0,
    damage: p.totalDamageDealtToChampions ?? 0,
    gold: p.goldEarned ?? 0,
    visionScore: p.visionScore ?? 0,
    queueId: match.info.queueId ?? 0,
  };
}
