import { Connection } from "../redis/redis.js";
import Queue from "bull";

const rateQueue = new Queue("insert-rate", {
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

export default rateQueue;