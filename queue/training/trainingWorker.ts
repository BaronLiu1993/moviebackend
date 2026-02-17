import { Worker, Job } from "bullmq";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { Connection } from "../redis/redis.js";
import { createSupabaseClient } from "../../service/supabase/configureSupabase.js";


const worker = new Worker(
  "training-sync",
  async () => {
    
  },
  { connection: Connection, concurrency: 1 }
);

worker.on("failed", (job, err) => {
  console.error(`[TrainingWorker] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`[TrainingWorker] Job ${job?.id} completed`);
});

export default worker;
