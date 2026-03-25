import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is required to run BullMQ.");
}

export const redisConnection = new IORedis(redisUrl, {
  // Keep trying for transient startup races (e.g., docker compose still bringing up Redis).
  maxRetriesPerRequest: null,
});

