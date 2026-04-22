import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@clickhouse/client";
import type { FilmType } from "../feed/feedService.js";

const PYTHON_SCRIPT = resolve(import.meta.dirname, "../../ranking/inference/inference.py");

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "default",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

function runInference(input: object): Promise<{ scores: number[] }> {
  return new Promise((resolve, reject) => {
    const proc = execFile("python3", [PYTHON_SCRIPT], { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`Inference failed: ${stderr || err.message}`));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Invalid JSON from inference: ${stdout}`));
      }
    });
    proc.stdin!.write(JSON.stringify(input));
    proc.stdin!.end();
  });
}

function parseVector(v: unknown): number[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); }
    catch { return null; }
  }
  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
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

function genreOverlap(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

export const reRankWithXGBoost = async (
  supabaseClient: SupabaseClient,
  userId: UUID,
  films: FilmType[],
  surface: string = "feed",
): Promise<FilmType[]> => {
  if (films.length === 0) return films;
  try {
    const tmdbIds = films.map((f) => f.tmdb_id);
    const now = new Date();

    // Fetch user profile + film embeddings in parallel
    const [userResult, filmResult, userFeatures, filmFeatures] = await Promise.all([
      supabaseClient
        .from("User_Profiles")
        .select("profile_embedding, genres")
        .eq("user_id", userId)
        .single(),
      supabaseClient
        .from("Guanghai")
        .select("tmdb_id, film_embedding, genre_ids")
        .in("tmdb_id", tmdbIds),
      clickhouse.query({
        query: `
          SELECT
            countMerge(total_interactions) AS user_total_interactions,
            countMerge(total_ratings) AS user_total_ratings,
            countMerge(total_likes) AS user_total_likes,
            countMerge(total_bookmarks) AS user_total_bookmarks,
            avgMerge(avg_rating) AS user_avg_rating
          FROM user_features_mv
          WHERE user_id = {userId:String}
        `,
        query_params: { userId },
        format: "JSONEachRow",
      }),
      clickhouse.query({
        query: `
          SELECT
            tmdb_id,
            countMerge(film_total_interactions) AS film_total_interactions,
            countMerge(film_total_ratings) AS film_total_ratings,
            avgMerge(film_avg_rating) AS film_avg_rating,
            countMerge(film_like_count) AS film_like_count,
            countMerge(film_bookmark_count) AS film_bookmark_count
          FROM film_features_mv
          WHERE tmdb_id IN ({tmdbIds:Array(UInt32)})
          GROUP BY tmdb_id
        `,
        query_params: { tmdbIds },
        format: "JSONEachRow",
      }),
    ]);

    const userEmb = parseVector(userResult.data?.profile_embedding);
    const userGenres: number[] = userResult.data?.genres ?? [];
    const userFeatRows = await userFeatures.json() as any[];
    const filmFeatRows = await filmFeatures.json() as any[];

    const userFeat = userFeatRows[0] ?? {};
    const filmFeatMap = new Map(filmFeatRows.map((r: any) => [Number(r.tmdb_id), r]));
    const filmEmbMap = new Map(
      (filmResult.data ?? []).map((f: any) => [f.tmdb_id, { embedding: parseVector(f.film_embedding), genre_ids: f.genre_ids }]),
    );

    const surfaceEncoded = surface === "feed" ? 0 : surface === "search" ? 1 : surface === "profile" ? 2 : 3;

    // Build feature vectors
    const candidates = films.map((film, i) => {
      const filmEmb = filmEmbMap.get(film.tmdb_id);
      const filmFeat = filmFeatMap.get(film.tmdb_id) ?? {};

      return {
        embedding_similarity: userEmb && filmEmb?.embedding ? cosineSimilarity(userEmb, filmEmb.embedding) : 0,
        genre_overlap: genreOverlap(userGenres, filmEmb?.genre_ids ?? film.genre_ids),
        display_position: i,
        surface_encoded: surfaceEncoded,
        hour_of_day: now.getHours(),
        day_of_week: now.getDay() || 7,
        user_total_interactions: Number(userFeat.user_total_interactions ?? 0),
        user_total_ratings: Number(userFeat.user_total_ratings ?? 0),
        user_total_likes: Number(userFeat.user_total_likes ?? 0),
        user_total_bookmarks: Number(userFeat.user_total_bookmarks ?? 0),
        user_avg_rating: Number(userFeat.user_avg_rating ?? 0),
        film_total_interactions: Number(filmFeat.film_total_interactions ?? 0),
        film_total_ratings: Number(filmFeat.film_total_ratings ?? 0),
        film_avg_rating: Number(filmFeat.film_avg_rating ?? 0),
        film_like_count: Number(filmFeat.film_like_count ?? 0),
        film_bookmark_count: Number(filmFeat.film_bookmark_count ?? 0),
      };
    });

    const { scores } = await runInference({ candidates });

    // Re-sort films by predicted score descending
    const scored = films.map((film, i) => ({ film, score: scores[i] ?? 0.5 }));
    scored.sort((a, b) => b.score - a.score);

    return scored.map((s) => s.film);
  } catch (err) {
    console.error("[reRankWithXGBoost] Failed, falling back to original order:", err);
    return films;
  }
};
