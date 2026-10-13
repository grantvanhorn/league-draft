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

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use("/api/players", playersRouter);
app.use("/api/team", teamRouter);
app.use("/api/drafts", draftRouter);
app.use("/api/champions", championsRouter);
app.use("/api/tournament", tournamentRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
initIO(httpServer);

httpServer.listen(PORT, () => {
  console.log(`League draft API running on http://localhost:${PORT}`);
});
