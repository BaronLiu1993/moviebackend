import { Worker } from "bullmq";
import { Connection } from "../redis/redis.js";
import scrapeFilms from "../../etl/scrapeFilms.js";
import { embedFilms } from "../../etl/embedFilms.js";

const worker = new Worker("scrape", async (job) => {
  console.log(`[ScrapeWorker] Starting pipeline`);

  await job.updateProgress(10);
  await scrapeFilms();

  await job.updateProgress(50);
  await embedFilms();

  await job.updateProgress(100);
  console.log(`[ScrapeWorker] Pipeline complete`);
}, {
  connection: Connection,
  concurrency: 1,
});

worker.on("failed", (job, err) => {
  console.error(`[ScrapeWorker] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`[ScrapeWorker] Job ${job?.id} completed`);
});

export default worker;
