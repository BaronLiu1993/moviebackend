import { createClient } from "@clickhouse/client";
import type { UUID } from "node:crypto";

const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "default",
  database: "default",
});

interface Interaction {
  userId: string;
  tmdbId: number;
  name: string;
  interactionType: "click" | "like" | "rating" | "bookmark";
  rating?: number;
}

interface Impression {
  userId: string;
  tmdbId: number;
  sessionId: string;
  position: number;
  surface: string;
}

// Insert a clickhouse interaction record for analytics
export async function insertInteractionEvents(event: Interaction) {
  const { userId, tmdbId, interactionType, rating } = event;
  const test = await client.insert({
    table: "interactions",
    values: [
      {
        interaction_id: crypto.randomUUID(),
        user_id: userId,
        film_id: tmdbId,
        interaction_type: interactionType,
        rating: rating ?? 0,
        created_at: new Date().toISOString(),
      },
    ],
    format: "JSONEachRow",
  });
  console.log(test)
}

export async function insertImpressionEvent(event: Impression) {
  const { userId, tmdbId, position, surface, sessionId } = event;

  const test =await client.insert({
    table: "impressions",
    values: [
      {
        impression_id: crypto.randomUUID(),
        user_id: userId,
        film_id: tmdbId,
        session_id: sessionId,
        position,
        surface,
        shown_at: new Date().toISOString(),
      },
    ],
    format: "JSONEachRow",
  });
  console.log(test)
}

// Aggregate and group data by the
export const getFilmFeatures = async () => {
  const result = await client.query({
    query: `
        SELECT 
          film_id,
          film_name,
          COUNT(*) AS total_interactions,
          countIf(interaction_type = 'rating') AS impression_count,
          countIf(interaction_type = 'like') AS like_count,
          countIf(interaction_type = 'bookmark') AS interaction_count,
          avgIf(rating, rating > 0) AS avg_rating,
          arrayJoin(film_genre) AS genre_list
        FROM interactions
        GROUP BY film_id, film_name
        `,
    format: "JSONEachRow",
  });
  return result.json();
};

// Generate features for ML model training by aggregating interactions
export const aggregateInteractions = async () => {
  try {
    const result = await client.query({
      query: `
        SELECT 
          user_id,
          film_id,
          COUNT(*) AS interaction_count
        FROM user_interactions
        GROUP BY user_id, film_id
      `,
      format: "JSONEachRow",
    });

    const data = await result.json();
    return data;
  } catch (error) {
    console.error("Error aggregating interactions:", error);
  }
};
