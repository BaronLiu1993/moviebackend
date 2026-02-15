import type { UUID } from "node:crypto";
import { sendEventToKafkaRecommendations } from "../kafka/configureKafkaProducer.js";

type KafkaEvent = {
  userId: UUID;
  filmId: number;
  name: string;
  genre: string[];
};

type KafkaRatingEvent = {
  userId: UUID;
  filmId: number;
  rating: number;
  name: string;
  genre: string[];
};

export const handleLike = async ({
  userId,
  filmId,
  name,
  genre,
}: KafkaEvent) => {
  try {
    await sendEventToKafkaRecommendations({
      userId,
      filmId,
      name,
      genre,
      timestamp: new Date().toISOString(),
      interactionType: "like",
    });
  } catch (err) {
    console.error("Failed to log recommendation like:", err);
  }
};

export const handleRating = async ({
  userId,
  filmId,
  name,
  genre,
  rating,
}: KafkaRatingEvent) => {
  try {
    await sendEventToKafkaRecommendations({
      userId,
      filmId,
      name,
      genre,
      rating,
      timestamp: new Date().toISOString(),
      interactionType: "rating",
    });
  } catch (err) {
    console.error("Failed to log recommendation like:", err);
  }
};

export const handleClick = async ({
  userId,
  filmId,
  name,
  genre,
}: KafkaEvent) => {
  try {
    await sendEventToKafkaRecommendations({
      userId,
      filmId,
      name,
      genre,
      timestamp: new Date().toISOString(),
      interactionType: "click",
    });
  } catch (err) {
    console.error("Failed to log recommendation click:", err);
  }
};

// Click and view for 5 seconds or more counts as an impression
export const handleImpression = async ({
  userId,
  filmId,
  name,
  genre,
}: KafkaEvent) => {
  try {
    await sendEventToKafkaRecommendations({
      userId,
      filmId,
      name,
      genre,
      timestamp: new Date().toISOString(),
      interactionType: "impression",
    });
  } catch (err) {
    console.error("Failed to log recommendation impression:", err);
  }
};
