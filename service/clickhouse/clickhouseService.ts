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
  genre_ids?: number[] | undefined;
  film_name?: string | undefined;
}

// Insert a clickhouse interaction record for analytics
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
      },
    ],
    format: "JSONEachRow",
  });
}

export async function insertImpressionEvent(event: Impression) {
  const { userId, tmdbId, position, surface, sessionId, genre_ids, film_name } =
    event;
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
      },
    ],
    format: "JSONEachRow",
  });
}

//-- Each row = one (user, film) impression that was shown in a feed
//-- label = 1 if user interacted with this film (at any time), 0 otherwise
//-- This version avoids NULLs by filling missing averages with 0.

async function generateTrainingData() {
  const resultSet = await client.query({
    query: `
    SELECT
      i.user_id,
      i.tmdb_id,
      i.position,
      i.surface,
      IF(ix.tmdb_id IS NOT NULL, 1, 0) AS label,
      u.total_interactions,
      u.total_ratings,
      u.total_likes,
      u.total_bookmarks,
      u.avg_rating,
      f.film_total_interactions,
      f.film_total_ratings,
      f.film_avg_rating,
      f.film_like_count,
      f.film_bookmark_count,
      i.position AS display_position
    FROM impressions i
    LEFT JOIN (
      SELECT DISTINCT user_id, tmdb_id
      FROM interactions
    ) ix ON i.user_id = ix.user_id AND i.tmdb_id = ix.tmdb_id
    LEFT JOIN (
      SELECT
        user_id,
        COUNT(*) AS total_interactions,
        countIf(interaction_type = 'rating') AS total_ratings,
        countIf(interaction_type = 'like') AS total_likes,
        countIf(interaction_type = 'bookmark') AS total_bookmarks,
        ifNull(avgIf(rating, interaction_type = 'rating' AND rating > 0), 0) AS avg_rating
      FROM interactions
      GROUP BY user_id
    ) u ON i.user_id = u.user_id
    LEFT JOIN (
      SELECT
        tmdb_id,
        COUNT(*) AS film_total_interactions,
        countIf(interaction_type = 'rating') AS film_total_ratings,
        ifNull(avgIf(rating, interaction_type = 'rating' AND rating > 0), 0) AS film_avg_rating,
        countIf(interaction_type = 'like') AS film_like_count,
        countIf(interaction_type = 'bookmark') AS film_bookmark_count
      FROM interactions
      GROUP BY tmdb_id
    ) f ON i.tmdb_id = f.tmdb_id
  `,
    format: "JSONEachRow",
  });
  const rows = await resultSet.json();
  return rows;
}
