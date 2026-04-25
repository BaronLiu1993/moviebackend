import { Worker } from "bullmq";
import { Connection } from "../redis/redis.js";
import scrapeFilms from "../../etl/scrapeFilms.js";
import { embedFilms } from "../../etl/embedFilms.js";
import log from "../../lib/logger.js";

const worker = new Worker("scrape", async (job) => {
  log.info({ jobId: job.id }, "Scrape pipeline starting");

  await job.updateProgress(10);
  await scrapeFilms();
  await job.updateProgress(50);
  await embedFilms();
  await job.updateProgress(100);
  log.info({ jobId: job.id }, "Scrape pipeline complete");
}, {
  connection: Connection,
  concurrency: 1,
});

worker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, "Scrape job failed");
});

worker.on("completed", (job) => {
  log.info({ jobId: job?.id }, "Scrape job completed");
});

export default worker;
