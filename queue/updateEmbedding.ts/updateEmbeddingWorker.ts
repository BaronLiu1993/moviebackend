import { Worker, Job } from "bullmq";
import { Connection } from "../redis/redis.js";
import { createServerSideSupabaseClient, createSupabaseClient } from "../../service/supabase/configureSupabase.js";

const worker = new Worker(
  "embedding-sync",
  async (job: Job<{ userId: string, accessToken: string }>) => {
    const { userId, accessToken } = job.data;
    const supabase = createSupabaseClient({ accessToken });

    const { error } = await supabase.rpc("recompute_user_embedding", {
      p_user_id: userId,
    });

    if (error) throw new Error(`Failed to recompute embedding for user ${userId}: ${error.message}`);
  },
  { connection: Connection }
);

worker.on("failed", (job, err) => {
  console.error(`Embedding recompute failed for job ${job?.id}:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`Embedding recompute completed for job ${job?.id}`);
});

export default worker;
