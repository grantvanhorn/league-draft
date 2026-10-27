import { useEffect, useRef, useState, useCallback } from "react";
import { getDeathHeatmap, getDDVersion } from "../lib/api";
import { DeathEvent, DeathHeatmapData, HeatmapGameSummary } from "../types";

const GAME_NAME = "ransom";
const TAG_LINE = "rnsm";
const MAP_BOUNDS = 15000;
const CANVAS_SIZE = 512;
const HEAT_RADIUS = CANVAS_SIZE * 0.06;

function msToGameTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function gameCoordToCanvas(x: number, y: number): [number, number] {
  const px = (x / MAP_BOUNDS) * CANVAS_SIZE;
  const py = (1 - y / MAP_BOUNDS) * CANVAS_SIZE;
  return [px, py];
}

function drawHeatmap(
  canvas: HTMLCanvasElement,
  mapImg: HTMLImageElement,
  deaths: DeathEvent[],
  hoveredDeath: DeathEvent | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Map background
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(mapImg, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (deaths.length === 0) return;

  // Heat glow layer — draw to offscreen canvas then composite
  const offscreen = document.createElement("canvas");
  offscreen.width = CANVAS_SIZE;
  offscreen.height = CANVAS_SIZE;
  const octx = offscreen.getContext("2d")!;
  octx.globalCompositeOperation = "lighter"; // additive blending for heat effect

  for (const d of deaths) {
    const [px, py] = gameCoordToCanvas(d.position.x, d.position.y);
    const grad = octx.createRadialGradient(px, py, 0, px, py, HEAT_RADIUS);
    grad.addColorStop(0, "rgba(220, 38, 38, 0.45)");
    grad.addColorStop(0.4, "rgba(255, 120, 0, 0.25)");
    grad.addColorStop(1, "rgba(220, 38, 38, 0)");
    octx.fillStyle = grad;
    octx.beginPath();
    octx.arc(px, py, HEAT_RADIUS, 0, Math.PI * 2);
    octx.fill();
  }

  // Composite heat layer over map with screen blending
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 1;
  ctx.drawImage(offscreen, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  // Death markers
  for (const d of deaths) {
    const [px, py] = gameCoordToCanvas(d.position.x, d.position.y);
    const isHovered = hoveredDeath === d;

    ctx.beginPath();
    ctx.arc(px, py, isHovered ? 7 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isHovered ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.85)";
    ctx.fill();
    ctx.strokeStyle = isHovered ? "#ef4444" : "rgba(185, 28, 28, 0.9)";
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    ctx.stroke();
  }
}

export default function DeathHeatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const [data, setData] = useState<DeathHeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<number | null>(null); // null = all
  const [hoveredDeath, setHoveredDeath] = useState<DeathEvent | null>(null);
  const [ddVersion, setDdVersion] = useState("14.24.1");

  const visibleDeaths = data
    ? selectedGame === null
      ? data.deaths
      : data.deaths.filter((d) => d.gameIndex === selectedGame)
    : [];

  const redraw = useCallback(() => {
    if (!canvasRef.current || !mapImgRef.current) return;
    drawHeatmap(canvasRef.current, mapImgRef.current, visibleDeaths, hoveredDeath);
  }, [visibleDeaths, hoveredDeath]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    getDDVersion()
      .then(({ version }) => setDdVersion(version))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getDeathHeatmap(GAME_NAME, TAG_LINE)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load data");
        setLoading(false);
      });
  }, []);

  // Load map image once ddragon version is available
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/map/map11.png`;
    img.onload = () => {
      mapImgRef.current = img;
      redraw();
    };
  }, [ddVersion, redraw]);

  // Canvas mouse events for hover detection
  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current || visibleDeaths.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = CANVAS_SIZE / rect.width;
    const mx = (e.clientX - rect.left) * scale;
    const my = (e.clientY - rect.top) * scale;

    let closest: DeathEvent | null = null;
    let closestDist = 16; // px threshold
    for (const d of visibleDeaths) {
      const [px, py] = gameCoordToCanvas(d.position.x, d.position.y);
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = d;
      }
    }
    setHoveredDeath(closest);
  }

  function handleCanvasMouseLeave() {
    setHoveredDeath(null);
  }

  const champIconUrl = (name: string) =>
    `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${name}.png`;

  return (
    <div style={{ color: "#e2e8f0" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
          Death Heatmap — {GAME_NAME}#{TAG_LINE}
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>
          Last 10 Flex SR games · Summoner's Rift death positions
        </p>
      </div>

      {loading && (
        <div style={{ color: "#94a3b8", padding: "40px 0", textAlign: "center" }}>
          Loading…
        </div>
      )}

      {error && (
        <div style={{ background: "#450a0a", border: "1px solid #991b1b", borderRadius: 8, padding: "12px 16px", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Game selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button
              onClick={() => setSelectedGame(null)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: selectedGame === null ? "#3b82f6" : "#334155",
                background: selectedGame === null ? "#1e3a5f" : "#1e293b",
                color: selectedGame === null ? "#93c5fd" : "#94a3b8",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: selectedGame === null ? 600 : 400,
              }}
            >
              All Games ({data.deaths.length} deaths)
            </button>
            {data.games.map((g) => (
              <GameTab
                key={g.matchId}
                game={g}
                selected={selectedGame === g.gameIndex}
                onClick={() => setSelectedGame(selectedGame === g.gameIndex ? null : g.gameIndex)}
                ddVersion={ddVersion}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Map canvas */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                style={{ width: 460, height: 460, borderRadius: 8, border: "1px solid #1e293b", cursor: "crosshair" }}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={handleCanvasMouseLeave}
              />
              {hoveredDeath && (
                <DeathTooltip death={hoveredDeath} ddVersion={ddVersion} champIconUrl={champIconUrl} />
              )}
              {visibleDeaths.length === 0 && data && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(15,23,42,0.75)", borderRadius: 8, color: "#94a3b8",
                }}>
                  No deaths in selected game(s)
                </div>
              )}
            </div>

            {/* Death list */}
            <div style={{ flex: 1, minWidth: 300 }}>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>
                {visibleDeaths.length} death{visibleDeaths.length !== 1 ? "s" : ""}
                {selectedGame !== null ? ` in game ${selectedGame}` : " across all games"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 460, overflowY: "auto" }}>
                {visibleDeaths.map((d, idx) => (
                  <DeathRow
                    key={`${d.matchId}-${d.timestamp}-${idx}`}
                    death={d}
                    ddVersion={ddVersion}
                    champIconUrl={champIconUrl}
                    isHovered={hoveredDeath === d}
                    onMouseEnter={() => setHoveredDeath(d)}
                    onMouseLeave={() => setHoveredDeath(null)}
                  />
                ))}
                {visibleDeaths.length === 0 && (
                  <div style={{ color: "#475569", padding: "16px 0" }}>No deaths to show</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GameTab({
  game,
  selected,
  onClick,
  ddVersion,
}: {
  game: HeatmapGameSummary;
  selected: boolean;
  onClick: () => void;
  ddVersion: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 6,
        border: "1px solid",
        borderColor: selected ? (game.win ? "#16a34a" : "#b91c1c") : "#334155",
        background: selected ? (game.win ? "#052e16" : "#450a0a") : "#1e293b",
        color: selected ? (game.win ? "#86efac" : "#fca5a5") : "#94a3b8",
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      <img
        src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${game.champion}.png`}
        alt={game.champion}
        style={{ width: 20, height: 20, borderRadius: 3, objectFit: "cover" }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <span style={{ fontWeight: selected ? 600 : 400 }}>
        G{game.gameIndex} · {game.deathCount}☠
      </span>
      <span style={{ color: game.win ? "#4ade80" : "#f87171" }}>
        {game.win ? "W" : "L"}
      </span>
    </button>
  );
}

function DeathRow({
  death,
  ddVersion,
  champIconUrl,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: {
  death: DeathEvent;
  ddVersion: string;
  champIconUrl: (name: string) => string;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 6,
        background: isHovered ? "#1e3a5f" : "#1e293b",
        border: `1px solid ${isHovered ? "#3b82f6" : "#334155"}`,
        cursor: "default",
        transition: "background 0.1s, border-color 0.1s",
      }}
    >
      {/* Game badge */}
      <span style={{ fontSize: 10, color: "#64748b", minWidth: 24, textAlign: "center" }}>
        G{death.gameIndex}
      </span>

      {/* Time */}
      <span style={{ fontSize: 12, color: "#94a3b8", fontVariantNumeric: "tabular-nums", minWidth: 36 }}>
        {msToGameTime(death.timestamp)}
      </span>

      {/* Victim champion */}
      <img
        src={champIconUrl(death.victimChampion)}
        alt={death.victimChampion}
        title={`You (${death.victimChampion})`}
        style={{ width: 22, height: 22, borderRadius: 3, opacity: 0.7 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />

      <span style={{ color: "#64748b", fontSize: 11 }}>☠</span>

      {/* Killer */}
      {death.killerChampion ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <img
            src={champIconUrl(death.killerChampion)}
            alt={death.killerChampion}
            title={death.killerName ?? death.killerChampion}
            style={{ width: 22, height: 22, borderRadius: 3 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span style={{ fontSize: 12, color: "#cbd5e1" }}>{death.killerChampion}</span>
        </div>
      ) : (
        <span style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>Environment</span>
      )}

      {/* Assists */}
      {death.assistingChampions.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
          {death.assistingChampions.slice(0, 3).map((champ) => (
            <img
              key={champ}
              src={champIconUrl(champ)}
              alt={champ}
              title={`Assist: ${champ}`}
              style={{ width: 16, height: 16, borderRadius: 2, opacity: 0.65 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ))}
          {death.assistingChampions.length > 3 && (
            <span style={{ fontSize: 10, color: "#64748b" }}>+{death.assistingChampions.length - 3}</span>
          )}
        </div>
      )}

      {/* Win/Loss */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: death.win ? "#4ade80" : "#f87171",
          marginLeft: death.assistingChampions.length > 0 ? 4 : "auto",
        }}
      >
        {death.win ? "W" : "L"}
      </span>
    </div>
  );
}

function DeathTooltip({
  death,
  ddVersion,
  champIconUrl,
}: {
  death: DeathEvent;
  ddVersion: string;
  champIconUrl: (name: string) => string;
}) {
  const [px, py] = gameCoordToCanvas(death.position.x, death.position.y);
  // Scale to rendered canvas size (460px)
  const renderScale = 460 / CANVAS_SIZE;
  const left = px * renderScale;
  const top = py * renderScale;

  return (
    <div
      style={{
        position: "absolute",
        left: Math.min(left + 12, 320),
        top: Math.max(top - 60, 0),
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 8,
        padding: "8px 12px",
        pointerEvents: "none",
        zIndex: 10,
        minWidth: 160,
        boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
          {msToGameTime(death.timestamp)}
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>Game {death.gameIndex}</span>
        <span style={{ fontSize: 11, color: death.win ? "#4ade80" : "#f87171", fontWeight: 600 }}>
          {death.win ? "W" : "L"}
        </span>
      </div>

      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 2 }}>
        Killed by:{" "}
        {death.killerChampion ? (
          <span style={{ color: "#cbd5e1" }}>
            {death.killerChampion}
            {death.killerName ? ` (${death.killerName})` : ""}
          </span>
        ) : (
          <span style={{ fontStyle: "italic" }}>Environment</span>
        )}
      </div>

      {death.assistingChampions.length > 0 && (
        <div style={{ fontSize: 11, color: "#64748b" }}>
          Assists: {death.assistingChampions.join(", ")}
        </div>
      )}
    </div>
  );
}
