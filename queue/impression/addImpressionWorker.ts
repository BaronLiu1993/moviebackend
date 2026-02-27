import { Worker } from "bullmq";
import { Connection } from "../redis/redis.js";
import { insertImpressionEvent } from "../../service/clickhouse/clickhouseService.js";

const worker = new Worker("impression-sync", async (job) => {
    const { impression } = job.data;
    await insertImpressionEvent(impression);
}, {
  connection: Connection,
  concurrency: 1,
});

worker.on("failed", (job, err) => {});

worker.on("completed", (job) => {});

export default worker;
