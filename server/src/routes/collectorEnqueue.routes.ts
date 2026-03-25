import express from "express";
import { z } from "zod";
import { collectorQueue } from "../queue/collectorQueue";
import { fingerprintSql, normalizeSql } from "../utils/sqlFingerprint";
import { assertSafeReadOnlyQuery } from "../rawquery/rawQuery";

const router = express.Router();
const EnqueueSchema = z.object({
  tenantId: z.uuid(),
  query: z.string().min(1),
});

router.post("/collector/enqueue", async (req, res) => {
  const parsed = EnqueueSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Body must include valid `tenantId` (uuid) and `query`.",
    });
  }
  const tenantId = parsed.data.tenantId;
  const query = assertSafeReadOnlyQuery(parsed.data.query);

  try {
    const fingerprint = fingerprintSql(normalizeSql(query));
    const jobId = `${tenantId}:${fingerprint}:${new Date().toISOString().slice(0, 16)}`;
    const job = await collectorQueue.add(
      "collectAndStore",
      { tenantId, query },
      {
        jobId,
        removeOnComplete: 1000,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      },
    );

    return res.status(202).json({
      jobId: job.id,
      queue: job.queueName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

export default router;

