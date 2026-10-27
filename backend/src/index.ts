import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { initIO } from "./socket";
import playersRouter from "./routes/players";
import teamRouter from "./routes/team";
import draftRouter from "./routes/draft";
import championsRouter from "./routes/champions";
import tournamentRouter from "./routes/tournament";
import matchHistoryRouter from "./routes/matchhistory";
import refetchRouter from "./routes/refetch";
import deathHeatmapRouter from "./routes/deathheatmap";
import { getMatchWeeks, upsertMatchWeek } from "./services/storage";
import { week1 } from "./data/match-history-seed";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use("/api/players", playersRouter);
app.use("/api/team", teamRouter);
app.use("/api/drafts", draftRouter);
app.use("/api/champions", championsRouter);
app.use("/api/tournament", tournamentRouter);
app.use("/api/match-history", matchHistoryRouter);
app.use("/api/refetch", refetchRouter);
app.use("/api/death-heatmap", deathHeatmapRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Auto-seed week 1 if no match weeks exist yet
if (getMatchWeeks().length === 0) {
  upsertMatchWeek(week1);
  console.log("Seeded week 1 match data");
}

const httpServer = createServer(app);
initIO(httpServer);

httpServer.listen(PORT, () => {
  console.log(`League draft API running on http://localhost:${PORT}`);
});
