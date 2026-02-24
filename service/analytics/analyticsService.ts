import type { UUID } from "node:crypto";
import { sendInteractionEvent, sendImpressionEvent } from "../kafka/configureKafkaProducer.js";

type KafkaEvent = {
  userId: UUID;
  tmdbId: number;
  name: string;
  genre_ids: string[];
};

type KafkaRatingEvent = {
  userId: UUID;
  tmdbId: number;
  rating: number;
  name: string;
  genre_ids: string[];
};

type KafkaImpressionEvent = {
  userId: UUID;
  filmId: number;
  sessionId: UUID;
  genre_ids: string[];
  position: number;
  surface: string;
};

// Like, Rating, 

// Handlers for different types of user interactions with films, which will be sent to Kafka for analytics and recommendation purposes
export const handleLike = async ({
  userId,
  tmdbId,
  name,
  genre_ids,
}: KafkaEvent) => {
  try {
    await sendInteractionEvent({
      userId,
      tmdbId,
      name,
      genre_ids,
      timestamp: new Date().toISOString(),
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
  genre_ids,
  rating,
}: KafkaRatingEvent) => {
  try {
    await sendInteractionEvent({
      userId,
      tmdbId,
      name,
      genre_ids,
      rating,
      timestamp: new Date().toISOString(),
      interactionType: "rating",
    });
  } catch (err) {
    console.error("Failed to log recommendation rating:", err);
  }
};

// Click and view for 5 seconds or more counts as an impression
export const handleBookmark = async ({
  userId,
  tmdbId,
  name,
  genre_ids,
}: KafkaEvent) => {
  try {
    await sendInteractionEvent({
      userId,
      tmdbId,
      name,
      genre_ids,
      timestamp: new Date().toISOString(),
      interactionType: "bookmark",
    });
  } catch (err) {
    console.error("Failed to log recommendation bookmark:", err);
  }
};

export const handleImpression = async ({
  userId,
  filmId,
  sessionId,
  genre_ids,
  position,
  surface,
}: KafkaImpressionEvent) => {
  try {
    await sendImpressionEvent({
      userId,
      filmId,
      sessionId,
      genre_ids,
      position,
      surface,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to log recommendation impression:", err);
  }
};
