import { createClient } from "@clickhouse/client";

const client = createClient({   
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "default",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

interface Interaction {
  userId: string;
  filmId: string;
  name: string;
  genre: string[];
  interactionType: "click" | "impression" | "like";
  rating?: number;
}

// Insert a clickhouse interaction record for analytics
export async function insertInteraction(interaction: Interaction) {
    const { userId, filmId, name, genre, interactionType, rating } = interaction;
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
          rating: rating || null,
        },
      ],
    });
    console.log("Interaction inserted successfully");
  } catch (error) {
    console.error("Error inserting interaction:", error);
  }
}
