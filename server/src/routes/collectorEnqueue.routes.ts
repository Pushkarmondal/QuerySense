import express from "express";
import { collectorQueue } from "../queue/collectorQueue";

const router = express.Router();

router.post("/collector/enqueue", async (req, res) => {
  const { tenantId, query } = req.body ?? {};

  if (typeof tenantId !== "string" || typeof query !== "string") {
    return res.status(400).json({
      error: "Body must include `tenantId` and `query` as strings.",
    });
  }

  try {
    const job = await collectorQueue.add(
      "collectAndStore",
      { tenantId, query },
      {
        removeOnComplete: true,
        attempts: 3,
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

