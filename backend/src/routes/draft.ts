import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { saveDraft, getDraft, getDrafts, readData, writeData } from "../services/storage";
import { DraftState, Position } from "../types";
import { io } from "../socket";

const router = Router();

// Draft order: standard LoL tournament draft
// Ban phase 1: B B R R B R (3 blue, 3 red)
// Pick phase 1: B R R B B R
// Ban phase 2: R B R B     (2 blue, 2 red)
// Pick phase 2: R B B R B R
// But we track phase by step index for simplicity

type Step = { team: "blue" | "red"; action: "ban" | "pick" };

const DRAFT_SEQUENCE: Step[] = [
  // Ban phase 1 (6 bans)
  { team: "blue", action: "ban" },
  { team: "red", action: "ban" },
  { team: "blue", action: "ban" },
  { team: "red", action: "ban" },
  { team: "blue", action: "ban" },
  { team: "red", action: "ban" },
  // Pick phase 1 (6 picks)
  { team: "blue", action: "pick" },
  { team: "red", action: "pick" },
  { team: "red", action: "pick" },
  { team: "blue", action: "pick" },
  { team: "blue", action: "pick" },
  { team: "red", action: "pick" },
  // Ban phase 2 (4 bans)
  { team: "red", action: "ban" },
  { team: "blue", action: "ban" },
  { team: "red", action: "ban" },
  { team: "blue", action: "ban" },
  // Pick phase 2 (4 picks)
  { team: "red", action: "pick" },
  { team: "blue", action: "pick" },
  { team: "blue", action: "pick" },
  { team: "red", action: "pick" },
];

function getStepIndex(draft: DraftState): number {
  const bansDone = draft.blueBans.length + draft.redBans.length;
  const picksDone = draft.bluePicks.length + draft.redPicks.length;

  let banCount = 0;
  let pickCount = 0;
  for (let i = 0; i < DRAFT_SEQUENCE.length; i++) {
    const s = DRAFT_SEQUENCE[i];
    if (s.action === "ban" && banCount === bansDone && pickCount === picksDone)
      return i;
    if (
      s.action === "pick" &&
      banCount === bansDone &&
      pickCount === picksDone
    )
      return i;
    if (s.action === "ban") banCount++;
    else pickCount++;
  }
  return DRAFT_SEQUENCE.length; // complete
}

// GET /api/drafts
router.get("/", (_req: Request, res: Response) => {
  res.json(getDrafts());
});

// GET /api/drafts/:id
router.get("/:id", (req: Request, res: Response) => {
  const draft = getDraft(req.params.id);
  if (!draft) return res.status(404).json({ error: "Draft not found" });
  return res.json(draft);
});

// POST /api/drafts — create new draft
router.post("/", (req: Request, res: Response) => {
  const { blueTeamId, redTeamId } = req.body as {
    blueTeamId?: string;
    redTeamId?: string;
  };

  const draft: DraftState = {
    id: uuidv4(),
    blueTeam: blueTeamId ?? "blue",
    redTeam: redTeamId ?? "red",
    blueTeamId,
    redTeamId,
    phase: "ban1",
    turn: "blue",
    blueBans: [],
    redBans: [],
    bluePicks: [],
    redPicks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveDraft(draft);
  return res.json({ draft, sequence: DRAFT_SEQUENCE });
});

// POST /api/drafts/:id/action — make a pick or ban
router.post("/:id/action", (req: Request, res: Response) => {
  const draft = getDraft(req.params.id);
  if (!draft) return res.status(404).json({ error: "Draft not found" });

  const totalBans = draft.blueBans.length + draft.redBans.length;
  const totalPicks = draft.bluePicks.length + draft.redPicks.length;
  if (totalBans === 10 && totalPicks === 10) {
    return res.status(400).json({ error: "Draft is complete" });
  }

  const stepIdx = getStepIndex(draft);
  if (stepIdx >= DRAFT_SEQUENCE.length) {
    return res.status(400).json({ error: "Draft is complete" });
  }

  const currentStep = DRAFT_SEQUENCE[stepIdx];
  const { champion, position, team } = req.body as {
    champion: string;
    position?: Position;
    team?: "blue" | "red";
  };

  if (!champion) return res.status(400).json({ error: "champion is required" });

  // Verify team matches (or allow override in non-game context)
  if (team && team !== currentStep.team) {
    return res
      .status(400)
      .json({ error: `It's ${currentStep.team}'s turn to ${currentStep.action}` });
  }

  // Check champion not already banned/picked
  const allBanned = [...draft.blueBans, ...draft.redBans];
  const allPicked = [
    ...draft.bluePicks.map((p) => p.champion),
    ...draft.redPicks.map((p) => p.champion),
  ];
  if (
    allBanned.includes(champion) ||
    allPicked.includes(champion)
  ) {
    return res
      .status(400)
      .json({ error: `${champion} is already banned or picked` });
  }

  if (currentStep.action === "ban") {
    if (currentStep.team === "blue") draft.blueBans.push(champion);
    else draft.redBans.push(champion);
  } else {
    if (currentStep.team === "blue")
      draft.bluePicks.push({ champion, position: position ?? null });
    else draft.redPicks.push({ champion, position: position ?? null });
  }

  // Update turn for next step
  const nextIdx = stepIdx + 1;
  if (nextIdx < DRAFT_SEQUENCE.length) {
    draft.turn = DRAFT_SEQUENCE[nextIdx].team;
    draft.phase = `${DRAFT_SEQUENCE[nextIdx].action}${Math.floor(nextIdx / 6) + 1}` as never;
  } else {
    draft.phase = "complete";
  }

  saveDraft(draft);
  io?.to(`draft:${draft.id}`).emit("draft:updated", draft);
  return res.json({
    draft,
    nextStep: nextIdx < DRAFT_SEQUENCE.length ? DRAFT_SEQUENCE[nextIdx] : null,
  });
});

// POST /api/drafts/:id/undo — remove the last action
router.post("/:id/undo", (req: Request, res: Response) => {
  const draft = getDraft(req.params.id);
  if (!draft) return res.status(404).json({ error: "Draft not found" });

  const stepIdx = getStepIndex(draft);
  const lastIdx = draft.phase === "complete" ? DRAFT_SEQUENCE.length - 1 : stepIdx - 1;
  if (lastIdx < 0) return res.status(400).json({ error: "Nothing to undo" });

  const lastStep = DRAFT_SEQUENCE[lastIdx];
  if (lastStep.action === "ban") {
    if (lastStep.team === "blue") draft.blueBans.pop();
    else draft.redBans.pop();
  } else {
    if (lastStep.team === "blue") draft.bluePicks.pop();
    else draft.redPicks.pop();
  }

  // Recalculate phase and turn from new step index
  const newStepIdx = getStepIndex(draft);
  if (newStepIdx < DRAFT_SEQUENCE.length) {
    draft.turn = DRAFT_SEQUENCE[newStepIdx].team;
    draft.phase = `${DRAFT_SEQUENCE[newStepIdx].action}${Math.floor(newStepIdx / 6) + 1}` as never;
  }

  saveDraft(draft);
  io?.to(`draft:${draft.id}`).emit("draft:updated", draft);
  return res.json({ draft });
});

// PATCH /api/drafts/:id — update name and/or description
router.patch("/:id", (req: Request, res: Response) => {
  const draft = getDraft(req.params.id);
  if (!draft) return res.status(404).json({ error: "Draft not found" });
  const { name, description } = req.body as { name?: string; description?: string };
  if (name !== undefined) draft.name = name.trim() || undefined;
  if (description !== undefined) draft.description = description.trim() || undefined;
  saveDraft(draft);
  io?.to(`draft:${draft.id}`).emit("draft:updated", draft);
  return res.json({ draft });
});

// DELETE /api/drafts/:id
router.delete("/:id", (req: Request, res: Response) => {
  const draft = getDraft(req.params.id);
  if (!draft) return res.status(404).json({ error: "Draft not found" });
  const data = readData();
  data.drafts = data.drafts.filter((d: DraftState) => d.id !== req.params.id);
  writeData(data);
  io?.to(`draft:${req.params.id}`).emit("draft:deleted", req.params.id);
  return res.json({ success: true });
});

export default router;
