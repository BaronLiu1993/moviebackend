import { Worker } from "bullmq";
import { Connection } from "../redis/redis.js";
import scrapeFilms from "../../etl/scrapeFilms.js";

const worker = new Worker("scrape", async () => {
  await scrapeFilms();
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
