import { Connection } from "../redis/redis.js";
import { Queue } from "bullmq";

export type ScrapeJobData = {
  triggeredBy?: "github-action" | "manual";
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

export default scrapeQueue;