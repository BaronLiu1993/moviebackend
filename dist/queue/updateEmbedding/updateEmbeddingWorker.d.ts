import { Worker } from "bullmq";
import type { EmbeddingJobData } from "./updateEmbeddingQueue.js";
declare const worker: Worker<EmbeddingJobData, any, string>;
export default worker;
//# sourceMappingURL=updateEmbeddingWorker.d.ts.map