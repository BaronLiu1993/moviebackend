import { createClient } from "@clickhouse/client";

const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "default",
  database: "default",
});

interface Interaction {
  userId: string;
  tmdbId: number;
  interactionType: "click" | "like" | "rating" | "bookmark";
  rating?: number | undefined;
  genre_ids?: number[] | undefined;
  film_name?: string | undefined;
}

interface Impression {
  userId: string;
  tmdbId: number;
  sessionId: string;
  position: number;
  surface: string;
  genre_ids: number[];
  film_name: string;
  embedding_similarity?: number;
  genre_overlap?: number;
}

export async function insertInteractionEvents(event: Interaction) {
  const { userId, tmdbId, interactionType, rating, genre_ids, film_name } =
    event;
  await client.insert({
    table: "interactions",
    values: [
      {
        user_id: userId,
        tmdb_id: tmdbId,
        interaction_type: interactionType,
        rating: rating,
        genre_ids: genre_ids,
        film_name: film_name,
        created_at: new Date(),
      },
    ],
    format: "JSONEachRow",
  });
}

export async function insertImpressionEvent(event: Impression) {
  const { userId, tmdbId, position, surface, sessionId, genre_ids, film_name,
    embedding_similarity = 0, genre_overlap = 0 } = event;
  await client.insert({
    table: "impressions",
    values: [
      {
        user_id: userId,
        tmdb_id: tmdbId,
        session_id: sessionId,
        position: position,
        surface: surface,
        genre_ids: genre_ids,
        film_name: film_name,
        embedding_similarity,
        genre_overlap,
        created_at: new Date(),
      },
    ],
    format: "JSONEachRow",
  });
}

export async function generateTrainingData() {
  const resultSet = await client.query({
    query: `
    SELECT
      i.user_id,
      i.tmdb_id,
      IF(ix.tmdb_id IS NOT NULL, 1, 0) AS label,

      i.embedding_similarity,
      i.genre_overlap,
      i.position                        AS display_position,
      i.surface,
      toHour(i.created_at)              AS hour_of_day,
      toDayOfWeek(i.created_at)         AS day_of_week,

      countMerge(u.total_interactions)   AS user_total_interactions,
      countMerge(u.total_ratings)        AS user_total_ratings,
      countMerge(u.total_likes)          AS user_total_likes,
      countMerge(u.total_bookmarks)      AS user_total_bookmarks,
      avgMerge(u.avg_rating)             AS user_avg_rating,

      countMerge(f.film_total_interactions) AS film_total_interactions,
      countMerge(f.film_total_ratings)      AS film_total_ratings,
      avgMerge(f.film_avg_rating)           AS film_avg_rating,
      countMerge(f.film_like_count)         AS film_like_count,
      countMerge(f.film_bookmark_count)     AS film_bookmark_count

    FROM impressions i

    LEFT JOIN (
      SELECT DISTINCT user_id, tmdb_id, created_at AS interaction_time
      FROM interactions
    ) ix ON i.user_id = ix.user_id
         AND i.tmdb_id = ix.tmdb_id
         AND ix.interaction_time BETWEEN i.created_at AND i.created_at + INTERVAL 24 HOUR

    LEFT JOIN user_features_mv u ON i.user_id = u.user_id
    LEFT JOIN film_features_mv f ON i.tmdb_id = f.tmdb_id

    WHERE i.created_at >= now() - INTERVAL 90 DAY

    GROUP BY i.user_id, i.tmdb_id, i.embedding_similarity, i.genre_overlap, i.position, i.surface, i.created_at, label
    ORDER BY i.user_id, i.created_at
  `,
    format: "JSONEachRow",
  });
  const rows = await resultSet.json();
  return rows;
}
