import { Queue } from "bullmq";
import { redisConnection } from "./redisConnection";

export const DEAD_LETTER_QUEUE_NAME =
  process.env.BULLMQ_DEAD_LETTER_QUEUE_NAME ?? "querysense-dead-letter";

export const deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, {
  connection: redisConnection,
});

