import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Players from "./pages/Players";
import PlayerProfilePage from "./pages/PlayerProfile";
import TeamPage from "./pages/Team";
import DraftPage from "./pages/Draft";
import Tournament from "./pages/Tournament";
import WriteUp from "./pages/WriteUp";
import WriteUps from "./pages/WriteUps";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import MatchHistory from "./pages/MatchHistory";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <nav style={{ background: "#16213e", borderBottom: "1px solid #1e293b", padding: "0 24px", display: "flex", alignItems: "center", gap: 4, height: 56 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#3b82f6", marginRight: 24 }}>League Draft</span>
          {[
            { to: "/", label: "Team" },
            { to: "/players", label: "Players" },
            { to: "/teams", label: "Teams" },
            { to: "/tournament", label: "Tournament" },
            { to: "/draft", label: "Draft" },
            { to: "/matches", label: "Matches" },
            { to: "/write-ups", label: "Write-Ups" },
            { to: "/settings", label: "Settings" },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={({ isActive }) => ({
                padding: "0 14px",
                height: 56,
                display: "flex",
                alignItems: "center",
                color: isActive ? "#3b82f6" : "#cbd5e1",
                borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
                fontSize: 15,
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main style={{ padding: "24px" }}>
          <Routes>
            <Route path="/" element={<TeamPage />} />
            <Route path="/players" element={<Players />} />
            <Route path="/players/:puuid" element={<PlayerProfilePage />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/:id" element={<TeamDetail />} />
            <Route path="/tournament" element={<Tournament />} />
            <Route path="/draft" element={<DraftPage />} />
            <Route path="/draft/:id" element={<DraftPage />} />
            <Route path="/matches" element={<MatchHistory />} />
            <Route path="/write-ups" element={<WriteUps />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/write-ups/:week" element={<WriteUp />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
