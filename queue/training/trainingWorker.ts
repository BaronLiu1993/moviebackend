import { Worker } from "bullmq";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { Connection } from "../redis/redis.js";
import { generateTrainingData } from "../../service/clickhouse/clickhouseService.js";
import log from "../../lib/logger.js";

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
  log.info({ jobId: job.id }, "Training pipeline starting");

  const trainingData = await generateTrainingData();
  const rowCount = (trainingData as any[]).length;
  log.info({ jobId: job.id, rows: rowCount }, "Generated training data");

  if (rowCount < 100) {
    log.warn({ jobId: job.id, rows: rowCount }, "Insufficient training data, skipping");
    return;
  }

  await job.updateProgress(50);

  const result = await runPython(trainingData);
  log.info({ jobId: job.id, result }, "Training complete");

  await job.updateProgress(100);
}, {
  connection: Connection,
  concurrency: 1,
});

worker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, "Training job failed");
});

worker.on("completed", (job) => {
  log.info({ jobId: job?.id }, "Training job completed");
});

export default worker;
