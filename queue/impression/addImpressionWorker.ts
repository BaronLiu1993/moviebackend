import { Worker } from "bullmq";
import { Connection } from "../redis/redis.js";
import { insertImpressionEvent } from "../../service/clickhouse/clickhouseService.js";
import { createServerSideSupabaseClient } from "../../service/supabase/configureSupabase.js";

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

const genreOverlap = (userGenres: number[], filmGenres: number[]): number => {
  if (!userGenres.length || !filmGenres.length) return 0;
  const setA = new Set(userGenres);
  const setB = new Set(filmGenres);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...userGenres, ...filmGenres]).size;
  return union > 0 ? intersection / union : 0;
}

const DEDUP_TTL = 86400; // 24 hours

const worker = new Worker("impression-sync", async (job) => {
    const impression = job.data;

    // Dedup: skip if this (sessionId, userId, tmdbId) was already logged
    const dedupKey = `imp:${impression.sessionId}`;
    const member = `${impression.userId}:${impression.tmdbId}`;
    try {
      const alreadyLogged = await Connection.sismember(dedupKey, member);
      if (alreadyLogged) return;
    } catch {
      // Redis down — fail open, allow insert
    }

    const supabase = createServerSideSupabaseClient();
    let embedding_similarity = 0;
    let genre_overlap_score = 0;

    try {
      const [userResult, filmResult] = await Promise.all([
        supabase
          .from("User_Profiles")
          .select("profile_embedding, genres")
          .eq("user_id", impression.userId)
          .single(),
        supabase
          .from("Guanghai")
          .select("film_embedding")
          .eq("tmdb_id", impression.tmdbId)
          .single(),
      ]);

      const profileEmbedding = userResult.data?.profile_embedding;
      const filmEmbedding = filmResult.data?.film_embedding;

      if (profileEmbedding && filmEmbedding) {
        embedding_similarity = cosineSimilarity(profileEmbedding, filmEmbedding);
      }

      const userGenres: number[] = userResult.data?.genres ?? [];
      const filmGenres: number[] = impression.genre_ids ?? [];
      genre_overlap_score = genreOverlap(userGenres, filmGenres);
    } catch (err) {
      console.error(`[ImpressionWorker] Feature computation failed, defaulting to 0:`, err);
    }

    await insertImpressionEvent({
      ...impression,
      embedding_similarity,
      genre_overlap: genre_overlap_score,
    });

    // Mark as logged for dedup
    try {
      await Connection.sadd(dedupKey, member);
      await Connection.expire(dedupKey, DEDUP_TTL);
    } catch {
      // Redis down — dedup will miss but data is safe in ClickHouse
    }
}, {
  connection: Connection,
  concurrency: 5,
});

worker.on("failed", (job, err) => {
    console.error(`[ImpressionWorker] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
    console.log(`[ImpressionWorker] Job ${job?.id} completed`);
});

export default worker;
