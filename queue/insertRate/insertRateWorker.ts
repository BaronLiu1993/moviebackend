import { Worker } from "bullmq";
import { Connection } from "../redis/redis.js";

export const insertRateWorker = new Worker(
  "insert-rate",
  async (job) => {
    const { userId } = job.data;
    console.log(`[Worker] Starting job ${job.id} - Queue: insert-rate - User: ${userId}`);
    try {
      console.log(`[Worker] Processing job ${job.id} for user ${userId}`);
      // TODO: implement actual insert rate logic or call the rate service here
      
      return { userId, processedAt: new Date().toISOString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Worker] Processor error in job ${job.id}:`, message);
      throw err;
    }
  },
  {
    connection: Connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

insertRateWorker.on("completed", (job, result) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

insertRateWorker.on("failed", (job, err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[Worker] Job ${job?.id} failed - Attempt ${job?.attemptsMade}:`, message);
});

insertRateWorker.on("stalled", (jobId) => {
  console.warn(`[Worker] Job ${jobId} stalled and will be retried`);
});

insertRateWorker.on("error", (err) => {
  console.error(`[Worker] Internal worker error:`, err);
});