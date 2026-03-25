import express from "express";
import { prisma } from "../../db/prismaConnection";
import { collectorQueue } from "../queue/collectorQueue";
import { deadLetterQueue } from "../queue/deadLetterQueue";

const router = express.Router();

router.get("/ops/metrics", async (_req, res) => {
  try {
    const [collectorCounts, deadLetterCounts, tenantCount, templateCount] =
      await Promise.all([
        collectorQueue.getJobCounts("waiting", "active", "completed", "failed"),
        deadLetterQueue.getJobCounts("waiting", "active", "completed", "failed"),
        prisma.tenant.count(),
        prisma.queryTemplate.count(),
      ]);

    return res.status(200).json({
      collectorQueue: collectorCounts,
      deadLetterQueue: deadLetterCounts,
      tenantCount,
      queryTemplateCount: templateCount,
      ts: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "metrics_collection_failed",
      message,
      runbook: "Check Redis and Postgres connectivity, then inspect worker logs.",
    });
  }
});

export default router;

