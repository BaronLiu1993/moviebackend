import { createClient } from "@clickhouse/client";

const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "default",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

interface Interaction {
  userId: string;
  filmId: number;
  name: string;
  genre: string[];
  interactionType: "click" | "impression" | "like";
  rating?: number;
}

// Insert a clickhouse interaction record for analytics
export async function insertEvent(event: Interaction) {
  const { userId, filmId, name, genre, interactionType, rating } = event;
  try {
    await client.insert({
      table: "user_interactions",
      values: [
        {
          user_id: userId,
          film_id: filmId,
          film_name: name,
          film_genre: genre,
          interaction_type: interactionType,
          rating: rating,
        },
      ],
      format: "JSONEachRow",
    });
  } catch (error) {
    console.error("Error inserting interaction:", error);
  }
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
        FROM user_interactions
        GROUP BY film_id, film_name
        `,
        format: "JSONEachRow",
    });
    return result.json();
}

export const getUserFeatures = async () => {

}

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
}