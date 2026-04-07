import { Connection } from "../redis/redis.js";
import { Queue } from "bullmq";

export type ScrapeJobData = {
  triggeredBy?: "cron" | "manual";
};

const scrapeQueue = new Queue<ScrapeJobData>("scrape", {
  connection: Connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// Weekly scrape: Sunday 3 AM
scrapeQueue.upsertJobScheduler("weekly-scrape", {
  pattern: "0 3 * * 0",
}, {
  name: "scrape-films",
  data: { triggeredBy: "cron" },
});

export default scrapeQueue;