import { runCollectorCycle } from "../services/collectorProducer";
import { redisConnection } from "../queue/redisConnection";
import { prisma } from "../../db/prismaConnection";

const intervalMs = Number(process.env.COLLECTOR_INTERVAL_MS ?? 60000);

const runOnce = async () => {
  const result = await runCollectorCycle();
  console.log(
    `Collector cycle done: tenants=${result.tenantsProcessed} enqueued=${result.jobsEnqueued}`,
  );
};

const timer = setInterval(() => {
  void runOnce();
}, intervalMs);

void runOnce();

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down collector producer...`);
  clearInterval(timer);
  await prisma.$disconnect();
  redisConnection.disconnect();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

console.log(`Collector producer running every ${intervalMs}ms`);

