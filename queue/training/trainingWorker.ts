import { Worker } from "bullmq";
import { Connection } from "../redis/redis.js";


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
