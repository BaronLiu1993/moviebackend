import { Worker } from "bullmq";
import { Connection } from "../redis/redis.js";
import { deleteRating } from "../../service/rate/rateService.js";
import { createSupabaseClient } from "../../service/supabase/configureSupabase.js";

export const deleteRateWorker = new Worker(
  "delete-rate",
  async (job) => {
    const { userId, ratingId, accessToken } = job.data;
    console.log(
      `[Worker] Starting job ${job.id} - Queue: delete-rate - User: ${userId}`,
    );
    try {
      console.log(`[Worker] Processing job ${job.id} for user ${userId}`);
      const supabaseClient = createSupabaseClient({ accessToken });
      await deleteRating({ userId, supabaseClient, ratingId });
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
  },
);

deleteRateWorker.on("completed", (job, result) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

deleteRateWorker.on("failed", (job, err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    `[Worker] Job ${job?.id} failed - Attempt ${job?.attemptsMade}:`,
    message,
  );
});

deleteRateWorker.on("stalled", (jobId) => {
  console.warn(`[Worker] Job ${jobId} stalled and will be retried`);
});

deleteRateWorker.on("error", (err) => {
  console.error(`[Worker] Internal worker error:`, err);
});
