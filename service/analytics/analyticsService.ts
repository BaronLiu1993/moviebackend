import type { UUID } from "node:crypto";
import { insertInteractionEvents, insertImpressionEvent } from "../clickhouse/clickhouseService.js";

interface InteractionParams {
  userId: UUID;
  tmdbId: number;
  film_name?: string;
  genre_ids?: number[];
}

export const handleLike = async ({
  userId,
  tmdbId,
  film_name,
  genre_ids,
}: InteractionParams) => {
  try {
    await insertInteractionEvents({
      userId,
      tmdbId,
      interactionType: "like",
      film_name,
      genre_ids,
      rating: 0
    });
  } catch (err) {
    console.error("Failed to log like:", err);
  }
};

export const handleRating = async ({
  userId,
  tmdbId,
  film_name,
  genre_ids,
  rating,
}: InteractionParams & { rating: number }) => {
  try {
    await insertInteractionEvents({
      userId,
      tmdbId,
      interactionType: "rating",
      rating,
      film_name,
      genre_ids,
    });
  } catch (err) {
    console.error("Failed to log rating:", err);
  }
};

export const handleBookmark = async ({
  userId,
  tmdbId,
  film_name,
  genre_ids,
}: InteractionParams) => {
  try {
    await insertInteractionEvents({
      userId,
      tmdbId,
      interactionType: "bookmark",
      film_name,
      genre_ids,
      rating: 0
    });
  } catch (err) {
    console.error("Failed to log bookmark:", err);
  }
};