import express from "express";
import { prisma } from "../../db/prismaConnection";
import { collectorQueue } from "../queue/collectorQueue";
import { runCollectorCycle } from "../services/collectorProducer";

const router = express.Router();

router.post("/collector/run-once", async (_req, res) => {
  try {
    const result = await runCollectorCycle();
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

router.get("/collector/runs", async (req, res) => {
  const tenantId = req.query.tenantId;
  const limitParam = req.query.limit;
  let limit = 20;
  if (typeof limitParam === "string") {
    const parsed = Number.parseInt(limitParam, 10);
    if (!Number.isNaN(parsed)) limit = parsed;
  }
  limit = Math.max(1, Math.min(limit, 100));

  try {
    const runs = await prisma.collectorRun.findMany({
      where: typeof tenantId === "string" ? { tenantId } : undefined,
      orderBy: { ranAt: "desc" },
      take: limit,
    });
    return res.status(200).json({ runs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

router.get("/collector/queue/stats", async (_req, res) => {
  try {
    const counts = await collectorQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused",
    );
    return res.status(200).json({ queue: collectorQueue.name, counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

export default router;

