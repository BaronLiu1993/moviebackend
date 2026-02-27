import type { UUID } from "node:crypto";
import { insertInteractionEvents, insertImpressionEvent } from "../clickhouse/clickhouseService.js";

interface ImpressionEvent {
  userId: UUID;
  tmdbId: number;
  sessionId: UUID;
  position: number;
  surface: string;
}

// Single interaction handlers (used by individual routes)
export const handleLike = async ({
  userId,
  tmdbId,
  name,
}: {
  userId: UUID;
  tmdbId: number;
  name: string;
}) => {
  try {
    await insertInteractionEvents({
      userId,
      tmdbId,
      name,
      interactionType: "like",
    });
  } catch (err) {
    console.error("Failed to log recommendation like:", err);
  }
};

export const handleRating = async ({
  userId,
  tmdbId,
  name,
  rating,
}: {
  userId: UUID;
  tmdbId: number;
  name: string;
  rating: number;
}) => {
    console.log(tmdbId)
    
  try {
    await insertInteractionEvents({
      userId,
      tmdbId,
      name,
      interactionType: "rating",
      rating,
    });
  } catch (err) {
    console.error("Failed to log recommendation rating:", err);
  }
};

export const handleBookmark = async ({
  userId,
  tmdbId,
  name,
}: {
  userId: UUID;
  tmdbId: number;
  name: string;
}) => {
  try {
    await insertInteractionEvents({
      userId,
      tmdbId,
      name,
      interactionType: "bookmark",
    });
  } catch (err) {
    console.error("Failed to log recommendation bookmark:", err);
  }
};

// Batch impression handler
export const handleImpression = async (impressions: ImpressionEvent[]) => {
  try {
    const batchSize = 10;
    for (let i = 0; i < impressions.length; i += batchSize) {
      const batch = impressions.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (impression) => {
          const { userId, tmdbId, sessionId, position, surface } = impression;
          if (!userId || !tmdbId || !sessionId || !position || !surface) {
            throw new Error("Invalid impression in batch");
          }

          await insertImpressionEvent({
            userId,
            tmdbId,
            sessionId,
            position,
            surface,
          });
        })
      );
    }
  } catch (err) {
    console.error("Failed to log impression event:", err);
  }
};
