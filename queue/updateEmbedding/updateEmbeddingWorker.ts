import { Worker, Job } from "bullmq";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { Connection } from "../redis/redis.js";
import { createSupabaseClient } from "../../service/supabase/configureSupabase.js";
import type { EmbeddingJobData } from "./updateEmbeddingQueue.js";

const PYTHON_SCRIPT = resolve(import.meta.dirname, "../../ranking/compute/incremental_embedding.py");

function runPython(input: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const proc = execFile("python3", [PYTHON_SCRIPT], { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`Python process failed: ${stderr || err.message}`));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Invalid JSON from Python: ${stdout}`));
      }
    });
    proc.stdin!.write(JSON.stringify(input));
    proc.stdin!.end();
  });
}

const worker = new Worker<EmbeddingJobData>(
  "embedding-sync",
  async (job: Job<EmbeddingJobData>) => {
    const { userId, accessToken, operation, filmId, rating, oldRating } = job.data;
    console.log(`[EmbeddingWorker] ${operation} for user ${userId}, film ${filmId}`);

    const supabase = createSupabaseClient({ accessToken });

    // Fetch film embedding and user state in parallel
    const [filmResult, userResult] = await Promise.all([
      supabase
        .from("Guanghai")
        .select("film_embedding")
        .eq("tmdb_id", filmId)
        .single(),
      supabase
        .from("User_Profiles")
        .select("interest_embedding, behavioral_embedding, behavioral_weight_sum, rating_count")
        .eq("user_id", userId)
        .single(),
    ]);

    if (filmResult.error || !filmResult.data?.film_embedding) {
      console.warn(`[EmbeddingWorker] Film ${filmId} not in Guanghai, skipping`);
      return;
    }

    if (userResult.error || !userResult.data) {
      throw new Error(`Failed to fetch user profile: ${userResult.error?.message}`);
    }

    if (!userResult.data.interest_embedding) {
      throw new Error(`User ${userId} has no interest_embedding — registration incomplete`);
    }

    // Delegate vector math to Python/numpy
    const result = await runPython({
      operation,
      film_embedding: filmResult.data.film_embedding,
      interest_embedding: userResult.data.interest_embedding,
      behavioral_embedding: userResult.data.behavioral_embedding,
      behavioral_weight_sum: userResult.data.behavioral_weight_sum ?? 0,
      rating_count: userResult.data.rating_count ?? 0,
      rating,
      old_rating: oldRating ?? null,
    }) as {
      behavioral_embedding: number[] | null;
      behavioral_weight_sum: number;
      rating_count: number;
      profile_embedding: number[];
    };

    // Write results back
    const { error: updateError } = await supabase
      .from("User_Profiles")
      .update({
        behavioral_embedding: result.behavioral_embedding,
        behavioral_weight_sum: result.behavioral_weight_sum,
        rating_count: result.rating_count,
        profile_embedding: result.profile_embedding,
      })
      .eq("user_id", userId);

    if (updateError) throw new Error(`Failed to update profile: ${updateError.message}`);

    console.log(
      `[EmbeddingWorker] Done: ${operation} user=${userId} count=${result.rating_count} weight=${result.behavioral_weight_sum}`
    );
  },
  { connection: Connection, concurrency: 1 }
);

worker.on("failed", (job, err) => {
  console.error(`[EmbeddingWorker] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`[EmbeddingWorker] Job ${job?.id} completed`);
});

export default worker;
