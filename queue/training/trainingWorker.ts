import { Worker } from "bullmq";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { Connection } from "../redis/redis.js";
import { generateTrainingData } from "../../service/clickhouse/clickhouseService.js";

const PYTHON_SCRIPT = resolve(import.meta.dirname, "../../ranking/training/train.py");

function runPython(input: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const proc = execFile("python3", [PYTHON_SCRIPT], { timeout: 300_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`Training failed: ${stderr || err.message}`));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Invalid JSON from training: ${stdout}`));
      }
    });
    proc.stdin!.write(JSON.stringify(input));
    proc.stdin!.end();
  });
}

const worker = new Worker("training-sync", async (job) => {
  console.log("[TrainingWorker] Starting training pipeline...");

  const trainingData = await generateTrainingData();
  console.log(`[TrainingWorker] Generated ${(trainingData as any[]).length} training rows`);

  if ((trainingData as any[]).length < 100) {
    console.warn("[TrainingWorker] Insufficient training data, skipping");
    return;
  }

  await job.updateProgress(50);

  const result = await runPython(trainingData);
  console.log("[TrainingWorker] Training complete:", JSON.stringify(result));

  await job.updateProgress(100);
}, {
  connection: Connection,
  concurrency: 1,
});

worker.on("failed", (job, err) => {
  console.error(`[TrainingWorker] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`[TrainingWorker] Job ${job?.id} completed`);
});

export default worker;
