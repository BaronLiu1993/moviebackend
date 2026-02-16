import { Connection } from "../redis/redis.js";
import { Queue } from "bullmq";

export type EmbeddingJobData = {
  userId: string;
  accessToken: string;
  operation: "insert" | "update" | "delete";
  filmId: number;
  rating: number;
  oldRating?: number;
};

const updateEmbeddingQueue = new Queue<EmbeddingJobData>("embedding-sync", {
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

export default updateEmbeddingQueue;