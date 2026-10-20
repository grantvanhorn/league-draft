import { useState, useEffect, useRef } from "react";
import {
  getRefetchStatus,
  startRefetch,
  stopRefetch,
  importExternalData,
  getPlayers,
  type RefetchStatus,
} from "../lib/api";

interface Player {
  puuid: string;
  riotId: string;
}

const PHASE_LABEL: Record<string, string> = {
  idle: "Not started",
  fetching: "Fetching raw match data",
  rederiving: "Re-deriving player stats",
  done: "Complete",
  stopped: "Stopped",
  error: "Error",
};

function elapsed(startedAt: string | null): string {
  if (!startedAt) return "";
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function eta(status: RefetchStatus): string {
  if (!status.startedAt || status.phase !== "fetching") return "";
  const fetched = status.fetchedCount;
  const remaining = status.totalMatchIds - status.alreadyCached - fetched;
  if (fetched === 0 || remaining <= 0) return "";
  const ms = Date.now() - new Date(status.startedAt).getTime();
  const rate = fetched / (ms / 1000); // matches/sec
  const etaSec = Math.round(remaining / rate);
  const h = Math.floor(etaSec / 3600);
  const m = Math.floor((etaSec % 3600) / 60);
  return h > 0 ? `~${h}h ${m}m remaining` : `~${m}m remaining`;
}

export default function Settings() {
  const [status, setStatus] = useState<RefetchStatus | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPuuid, setSelectedPuuid] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importResult, setImportResult] = useState<{ source: string; matched: number; totalGames: number } | null>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchStatus();
    getPlayers().then((ps) => {
      setPlayers(ps as Player[]);
      if (ps.length > 0) setSelectedPuuid((ps[0] as Player).puuid);
    }).catch(() => {});
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function fetchStatus() {
    try {
      const s = await getRefetchStatus();
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    // Fire immediately, then every 2s
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 2000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => {
    if (status?.running) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [status?.running]);

  async function handleStart() {
    const body = await startRefetch();
    if (body.status) setStatus(body.status);
    startPolling();
  }

  async function handleStop() {
    await stopRefetch();
    await fetchStatus();
  }

  async function handleImport() {
    if (!selectedPuuid || !importJson.trim()) return;
    setImporting(true);
    setImportResult(null);
    setImportError("");
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(importJson);
      } catch {
        setImportError("Invalid JSON — could not parse the pasted content.");
        return;
      }
      const result = await importExternalData(selectedPuuid, parsed);
      setImportResult(result);
      setImportJson("");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportJson(String(ev.target?.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  const totalToFetch = status ? Math.max(status.totalMatchIds - status.alreadyCached, 1) : 1;
  const fetchProgress = status?.phase === "done" ? 100
    : status && totalToFetch > 0
      ? Math.min(Math.round(((status.fetchedCount + status.failedCount) / totalToFetch) * 100), 99)
      : 0;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
          Data Management
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#f1f5f9", margin: 0, letterSpacing: "-0.5px" }}>
          Settings
        </h1>
      </div>

      {/* Match Refetch */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "24px 28px", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
          Match Data Refetch
        </div>
        <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
          Re-fetches raw match data from the Riot API for all players and stores it locally. Uses relative CS comparison between bot lane partners to accurately determine support vs. ADC — fixing the role detection bug that labeled all bot lane players as <code style={{ background: "#0f172a", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>BOTTOM</code>. Resumable: cached matches are skipped on restart.
        </p>

        {/* Stats — always visible once status loads */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Total Matches", value: status ? status.totalMatchIds.toLocaleString() : "—" },
            { label: "Cached on Disk", value: status ? status.cachedOnDisk.toLocaleString() : "—", color: status?.cachedOnDisk ? "#4ade80" : "#94a3b8" },
            { label: "Fetched This Run", value: status ? status.fetchedCount.toLocaleString() : "—", color: "#60a5fa" },
            { label: "Failed", value: status ? status.failedCount.toLocaleString() : "—", color: status?.failedCount ? "#f87171" : "#94a3b8" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "#0f172a", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: stat.color ?? "#f1f5f9" }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Phase badge + timing */}
        {status && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: status.running || status.phase !== "idle" ? 14 : 0 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600,
              background: status.phase === "done" ? "#14532d" : status.phase === "stopped" ? "#450a0a" : status.running ? "#1e3a5f" : "#0f172a",
              color: status.phase === "done" ? "#4ade80" : status.phase === "stopped" ? "#f87171" : status.running ? "#60a5fa" : "#64748b",
              border: `1px solid ${status.phase === "done" ? "#4ade8044" : status.phase === "stopped" ? "#f8717144" : status.running ? "#3b82f644" : "#33415522"}`,
            }}>
              {status.running && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", display: "inline-block", animation: "pulse 1.5s infinite" }} />}
              {PHASE_LABEL[status.phase] ?? status.phase}
            </div>
            {status.running && status.startedAt && (
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {elapsed(status.startedAt)} elapsed — {eta(status)}
              </span>
            )}
            {!status.running && status.finishedAt && (
              <span style={{ fontSize: 13, color: "#64748b" }}>Finished {new Date(status.finishedAt).toLocaleTimeString()}</span>
            )}
          </div>
        )}

        {/* Progress bar while running */}
        {status?.running && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                {status.phase === "rederiving"
                  ? `Rederiving: ${status.rederivingPlayer ?? "..."}`
                  : `${status.currentMatchId ?? "..."}`}
              </span>
              <span style={{ fontSize: 12, color: "#cbd5e1" }}>{fetchProgress}%</span>
            </div>
            <div style={{ height: 6, background: "#0f172a", borderRadius: 999 }}>
              <div style={{
                height: "100%", borderRadius: 999,
                background: status.phase === "rederiving" ? "#a855f7" : "#3b82f6",
                width: status.phase === "rederiving" ? "100%" : `${fetchProgress}%`,
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        )}

        {status && status.errors.length > 0 && (
          <details style={{ marginBottom: 14 }}>
            <summary style={{ fontSize: 13, color: "#f87171", cursor: "pointer" }}>
              {status.errors.length} fetch error{status.errors.length !== 1 ? "s" : ""}
            </summary>
            <div style={{ marginTop: 8, maxHeight: 160, overflowY: "auto", background: "#0f172a", borderRadius: 8, padding: "8px 12px" }}>
              {status.errors.slice(0, 50).map((e) => (
                <div key={e.matchId} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                  <span style={{ color: "#f87171" }}>{e.matchId}</span> — {e.error}
                </div>
              ))}
            </div>
          </details>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleStart}
            disabled={status?.running}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "none", cursor: status?.running ? "not-allowed" : "pointer",
              background: status?.running ? "#334155" : "#3b82f6", color: status?.running ? "#64748b" : "#fff",
              fontSize: 14, fontWeight: 600,
            }}
          >
            {status?.phase === "done" || status?.phase === "stopped" ? "Restart Refetch" : "Start Refetch"}
          </button>
          {status?.running && (
            <button
              onClick={handleStop}
              style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #ef4444", cursor: "pointer", background: "transparent", color: "#ef4444", fontSize: 14, fontWeight: 600 }}
            >
              Stop
            </button>
          )}
          <button
            onClick={fetchStatus}
            style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #334155", cursor: "pointer", background: "transparent", color: "#94a3b8", fontSize: 14 }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* External Data Import */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "24px 28px" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
          External Data Import
        </div>
        <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
          Enrich match records from Mobalytics or op.gg. Paste the raw JSON response or upload a saved file. Match data is linked via numeric game ID, which is shared across the Riot API, Mobalytics, and op.gg.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: "#94a3b8", display: "block", marginBottom: 6 }}>Player</label>
          <select
            value={selectedPuuid}
            onChange={(e) => setSelectedPuuid(e.target.value)}
            style={{
              background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
              color: "#f1f5f9", fontSize: 14, padding: "8px 12px", width: "100%", maxWidth: 360,
            }}
          >
            {players.map((p) => (
              <option key={p.puuid} value={p.puuid}>{p.riotId}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <label style={{ fontSize: 13, color: "#94a3b8" }}>JSON Data</label>
            <label style={{
              padding: "3px 10px", borderRadius: 6, border: "1px solid #334155",
              cursor: "pointer", fontSize: 12, color: "#94a3b8", background: "#0f172a",
            }}>
              Upload file
              <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleFileUpload} />
            </label>
          </div>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='Paste Mobalytics GraphQL response or op.gg export JSON here...'
            style={{
              width: "100%", minHeight: 160, background: "#0f172a", border: "1px solid #334155",
              borderRadius: 8, color: "#e2e8f0", fontSize: 13, padding: "12px", resize: "vertical",
              fontFamily: "monospace", boxSizing: "border-box",
            }}
          />
        </div>

        {importResult && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#14532d", borderRadius: 8, border: "1px solid #4ade8044" }}>
            <span style={{ fontSize: 14, color: "#4ade80", fontWeight: 600 }}>
              Import successful
            </span>
            <span style={{ fontSize: 13, color: "#86efac", marginLeft: 10 }}>
              {importResult.matched} of {importResult.totalGames} games matched and enriched — source: {importResult.source}
            </span>
          </div>
        )}
        {importError && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#450a0a", borderRadius: 8, border: "1px solid #f8717144" }}>
            <span style={{ fontSize: 14, color: "#f87171" }}>{importError}</span>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={importing || !importJson.trim() || !selectedPuuid}
          style={{
            padding: "10px 24px", borderRadius: 8, border: "none",
            cursor: importing || !importJson.trim() || !selectedPuuid ? "not-allowed" : "pointer",
            background: importing || !importJson.trim() || !selectedPuuid ? "#334155" : "#3b82f6",
            color: importing || !importJson.trim() || !selectedPuuid ? "#64748b" : "#fff",
            fontSize: 14, fontWeight: 600,
          }}
        >
          {importing ? "Importing..." : "Import"}
        </button>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes shimmer { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}
