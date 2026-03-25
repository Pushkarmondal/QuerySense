import { Queue } from "bullmq";
import { redisConnection } from "./redisConnection";

export const COLLECTOR_QUEUE_NAME =
  process.env.BULLMQ_COLLECTOR_QUEUE_NAME ?? "querysense-collector";

export const collectorQueue = new Queue(COLLECTOR_QUEUE_NAME, {
  connection: redisConnection,
});

