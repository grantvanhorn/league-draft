let versionCache: string | null = null;

export async function getDDVersion(): Promise<string> {
  if (versionCache) return versionCache;
  const res = await fetch(
    "https://ddragon.leagueoflegends.com/api/versions.json"
  );
  const versions = (await res.json()) as string[];
  versionCache = versions[0];
  return versionCache;
}

export function champIconUrl(version: string, championId: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}`;
}

export function profileIconUrl(version: string, iconId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
}

export function rankEmblemUrl(tier: string): string {
  return `https://opgg-static.akamaized.net/images/medals_new/${tier.toLowerCase()}.png`;
}

export function formatRank(entry: {
  tier: string;
  rank: string;
  leaguePoints: number;
} | null): string {
  if (!entry) return "Unranked";
  return `${entry.tier} ${entry.rank} — ${entry.leaguePoints} LP`;
}

export const TIER_COLORS: Record<string, string> = {
  IRON: "#6b7280",
  BRONZE: "#a16207",
  SILVER: "#9ca3af",
  GOLD: "#d97706",
  PLATINUM: "#10b981",
  EMERALD: "#34d399",
  DIAMOND: "#60a5fa",
  MASTER: "#a855f7",
  GRANDMASTER: "#ef4444",
  CHALLENGER: "#f59e0b",
};

export function tierColor(tier?: string | null): string {
  return tier ? (TIER_COLORS[tier.toUpperCase()] ?? "#cbd5e1") : "#8899aa";
}

export function kdaRatio(
  kills: number,
  deaths: number,
  assists: number
): string {
  if (deaths === 0) return "Perfect";
  return ((kills + assists) / deaths).toFixed(2);
}
