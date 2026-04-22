import { Worker, Job } from "bullmq";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { Connection } from "../redis/redis.js";
import { createSupabaseClient } from "../../service/supabase/configureSupabase.js";
import type { EmbeddingJobData } from "./updateEmbeddingQueue.js";
import log from "../../lib/logger.js";

const PYTHON_SCRIPT = resolve(import.meta.dirname, "../../ranking/compute/incremental_embedding.py");

function parseVector(v: unknown): number[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return JSON.parse(v);
  return null;
}

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
    const { userId, accessToken, operation, tmdbId, rating, oldRating } = job.data;
    log.info({ jobId: job.id, operation, userId, tmdbId }, "Embedding job starting");
    const supabaseClient = createSupabaseClient({ accessToken });
    // Fetch film embedding and user state in parallel
    const [filmResult, userResult] = await Promise.all([
      supabaseClient  
        .from("Guanghai")
        .select("film_embedding")
        .eq("tmdb_id", tmdbId)
        .single(),
      supabaseClient
        .from("User_Profiles")
        .select("interest_embedding, behavioral_embedding, behavioral_weight_sum, rating_count")
        .eq("user_id", userId)
        .single(),
    ]);

    if (filmResult.error || !filmResult.data?.film_embedding) {
      log.warn({ tmdbId }, "Film not in Guanghai, skipping embedding");
      return;
    }

    if (userResult.error || !userResult.data) {
      throw new Error(`Failed to fetch user profile: ${userResult.error?.message}`);
    }

    if (!userResult.data.interest_embedding) {
      throw new Error(`User ${userId} has no interest_embedding — registration incomplete`);
    }

    const result = await runPython({
      operation,
      film_embedding: parseVector(filmResult.data.film_embedding),
      interest_embedding: parseVector(userResult.data.interest_embedding),
      behavioral_embedding: parseVector(userResult.data.behavioral_embedding),
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

    const { error: updateError } = await supabaseClient
      .from("User_Profiles")
      .update({
        behavioral_embedding: result.behavioral_embedding,
        behavioral_weight_sum: result.behavioral_weight_sum,
        rating_count: result.rating_count,
        profile_embedding: result.profile_embedding,
      })
      .eq("user_id", userId);

    if (updateError) throw new Error(`Failed to update profile: ${updateError.message}`);

    log.info({ operation, userId, ratingCount: result.rating_count, weightSum: result.behavioral_weight_sum }, "Embedding update complete");
  },
  { connection: Connection, concurrency: 1 }
);

worker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, "Embedding job failed");
});

worker.on("completed", (job) => {
  log.info({ jobId: job?.id }, "Embedding job completed");
});

export default worker;
