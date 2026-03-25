import express from "express";
import { prisma } from "../../db/prismaConnection";

const router = express.Router();

router.get("/query/templates/top", async (req, res) => {
  const tenantId = req.query.tenantId;
  const limitParam = req.query.limit;

  if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
    return res.status(400).json({ error: "Query param `tenantId` is required." });
  }

  let limit = 10;
  if (typeof limitParam === "string") {
    const parsed = Number.parseInt(limitParam, 10);
    if (!Number.isNaN(parsed)) limit = parsed;
  }
  limit = Math.max(1, Math.min(limit, 50));

  try {
    const templates = await prisma.queryTemplate.findMany({
      where: { tenantId },
      orderBy: { impactScore: "desc" },
      take: limit,
      select: {
        id: true,
        fingerprintHash: true,
        normalizedSql: true,
        rawSqlSample: true,
        totalCalls: true,
        totalTimeMs: true,
        meanTimeMs: true,
        minTimeMs: true,
        maxTimeMs: true,
        impactScore: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    });

    return res.status(200).json({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

export default router;

