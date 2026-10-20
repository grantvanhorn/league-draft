import { Link } from "react-router-dom";

const WRITE_UPS = [
  {
    week: 1,
    opponent: "HeyYouGuys!",
    division: "Lugia Division",
    subtitle: "Scouting report, ban priorities, and draft simulations",
    date: "Week 1",
  },
  {
    week: 2,
    opponent: "Ahrin's Uncles",
    division: "Lugia Division",
    subtitle: "Scouting report, ban priorities, and draft simulations",
    date: "Week 2",
  },
];

export default function WriteUps() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
          Collision Time
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#f1f5f9", margin: 0, letterSpacing: "-0.5px" }}>
          Match Write-Ups
        </h1>
        <p style={{ color: "#64748b", marginTop: 8, fontSize: 15 }}>
          Weekly scouting reports and draft prep
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {WRITE_UPS.map((wu) => (
          <Link
            key={wu.week}
            to={`/write-ups/${wu.week}`}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 12,
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                transition: "border-color 0.15s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#334155")}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                  {wu.date} — {wu.division}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
                  Collision Time <span style={{ color: "#3b82f6" }}>vs.</span> {wu.opponent}
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{wu.subtitle}</div>
              </div>
              <div style={{ fontSize: 22, color: "#3b82f6", flexShrink: 0 }}>→</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
