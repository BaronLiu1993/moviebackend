import { Connection } from "../redis/redis.js";
import { Queue } from "bullmq";

const queryQueue = new Queue("query", {
  connection: Connection,
  defaultJobOptions: {
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 50,
    },
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

export default insertRateQueue;