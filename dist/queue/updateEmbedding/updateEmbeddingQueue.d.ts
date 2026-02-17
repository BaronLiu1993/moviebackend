import { Queue } from "bullmq";
export type EmbeddingJobData = {
    userId: string;
    accessToken: string;
    operation: "insert" | "update" | "delete";
    filmId: number;
    rating: number;
    oldRating?: number;
};
declare const updateEmbeddingQueue: Queue<EmbeddingJobData, any, string, EmbeddingJobData, any, string>;
export default updateEmbeddingQueue;
//# sourceMappingURL=updateEmbeddingQueue.d.ts.map