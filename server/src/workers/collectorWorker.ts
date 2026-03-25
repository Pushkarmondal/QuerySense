import { Worker } from "bullmq";
import { redisConnection } from "../queue/redisConnection";
import { COLLECTOR_QUEUE_NAME } from "../queue/collectorQueue";
import { deadLetterQueue } from "../queue/deadLetterQueue";
import { storeQueryExplain } from "../services/storeQueryExplain";

type CollectAndStoreJobData = {
  tenantId: string;
  query: string;
};

const worker = new Worker(
  COLLECTOR_QUEUE_NAME,
  async (job) => {
    if (job.name !== "collectAndStore") return null;

    const data = job.data as CollectAndStoreJobData;
    const tenantId = data?.tenantId;
    const query = data?.query;

    if (typeof tenantId !== "string" || typeof query !== "string") {
      throw new Error("Job data must include `tenantId` and `query` as strings.");
    }

    const result = await storeQueryExplain({ tenantId, query });
    return {
      templateId: result.templateId,
      explainPlanId: result.explainPlanId,
    };
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

worker.on("completed", (job) => {
  console.log(
    `Collector job completed: ${job.name} jobId=${job.id} result=${JSON.stringify(job.returnvalue)}`,
  );
});

worker.on("failed", async (job, err) => {
  console.error(
    `Collector job failed: ${job?.name} jobId=${job?.id} error=${err?.message ?? "unknown"}`,
  );
  if (!job) return;
  await deadLetterQueue.add(
    "collector-dead-letter",
    {
      sourceJobId: job.id,
      name: job.name,
      data: job.data,
      error: err?.message ?? "unknown",
      failedAt: new Date().toISOString(),
    },
    { removeOnComplete: 5000 },
  );
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down BullMQ worker...`);
  await worker.close();
  redisConnection.disconnect();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

console.log(`Collector worker listening on queue: ${COLLECTOR_QUEUE_NAME}`);

