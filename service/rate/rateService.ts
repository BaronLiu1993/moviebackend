/**
 * This module handles:
 * - Selecting, inserting, updating, and deleting user ratings
 * - Generating and storing film embeddings from TMDB
 * - Updating user profile embeddings based on new ratings (matrix factorization)
 * - Computing predictions using dot products between user and film embeddings
 *
 * It combines Supabase RPCs and tables with OpenAI embeddings
 * and TMDB metadata to manage personalized film recommendations.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
import OpenAI from "openai";
import dotenv from "dotenv";
import { createServerSideSupabaseClient } from "../supabase/configureSupabase.js";
import { sendEventToKafka } from "../kafka/configureKafka.js";

dotenv.config();

// config
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;

// OpenAI & Supabase Admin Clients
const OpenAIClient = new OpenAI({ apiKey: OPENAI_KEY });
const supabaseAdmin = createServerSideSupabaseClient();

// Constants
const learningRate = 0.01;
const lambda = 0.01;
const confidenceMap: Record<number, number> = {
  1: 1.0,
  2: 0.7,
  3: 0.3,
  4: 0.7,
  5: 1.0,
};

// types
type RatingType = { supabaseClient: SupabaseClient; filmId: number };
type SelectRatingType = { supabaseClient: SupabaseClient; userId: UUID };
type InsertRatingType = {
  supabaseClient: SupabaseClient;
  rating: number;
  note: string;
  userId: UUID;
  filmId: number;
};
type UpdateRatingType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  ratingId: UUID;
  newRating: number;
};
type DeleteRatingType = { supabaseClient: SupabaseClient; ratingId: UUID; userId: UUID };
type EmbeddingRequestType = { filmId: number };
type VectorType = Float32Array;
type DotProductType = { u: VectorType; m: VectorType };
type KafkaEvent = {
  userId: UUID;
  filmId: number;
  name?: string;
  genre?: string;
};
// helpers
const computeDotProduct = ({ u, m }: DotProductType): number => {
  if (u.length !== m.length) throw new Error("Vector dimension mismatch");
  let sum = 0;
  for (let i = 0; i < u.length; i++) sum += u[i]! * m[i]!;
  return sum;
};

const checkFilmExists = async ({
  supabaseClient,
  filmId,
}: RatingType): Promise<boolean> => {
  const { data, error } = await supabaseClient
    .from("Film")
    .select("film_id")
    .eq("film_id", filmId)
    .single();

  return !!data && !error;
};

// Generate and store film embedding in Supabase
const generateFilmEmbedding = async ({ filmId }: EmbeddingRequestType) => {
  const [movieMetadataRes, movieKeywordsRes] = await Promise.all([
    fetch(`${TMDB_API_BASE}/3/movie/${filmId}`, {
      headers: { Authorization: `Bearer ${TMDB_API_KEY}` },
    }),
    fetch(`${TMDB_API_BASE}/3/movie/${filmId}/keywords`, {
      headers: { Authorization: `Bearer ${TMDB_API_KEY}` },
    }),
  ]);

  const [movieMetadata, movieKeywords] = await Promise.all([
    movieMetadataRes.json(),
    movieKeywordsRes.json(),
  ]);

  let inputString = "";
  if (Array.isArray(movieMetadata.genres)) {
    inputString += movieMetadata.genres.map((g: any) => g.name).join(" ");
  }
  if (Array.isArray(movieKeywords.keywords)) {
    inputString += movieKeywords.keywords.map((k: any) => k.name).join(" ");  
  }

  const response = await OpenAIClient.embeddings.create({
    model: "text-embedding-3-small",
    input: inputString,
    encoding_format: "float",
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Failed to generate film embedding");
  }

  const { error: insertionError } = await supabaseAdmin
    .from("Film")
    .insert({
      film_embedding: embedding,
      title: movieMetadata.title,
      release_year: movieMetadata.release_date,
    });

  if (insertionError) {
    throw new Error("Failed to insert film embedding");
  }
};

export const selectRatings = async ({
  userId,
  supabaseClient,
}: SelectRatingType) => {
  const { data, error } = await supabaseClient
    .from("Ratings")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to select ratings");
  return data;
};

export const insertRating = async ({
  supabaseClient,
  rating,
  note,
  userId,
  filmId,
}: InsertRatingType) => {
  const normalizedRating = (rating - 3) / 2;
  const confidence = confidenceMap[rating] ?? 0.5;

  // insert rating
  const { error: insertError } = await supabaseClient.from("Ratings").insert({
    user_id: userId,
    rating,
    note,
    film_id: filmId,
  });
  if (insertError) throw new Error("Failed to insert rating");

  // fetch user embedding
  const { data: userVector, error: userVectorError } = await supabaseClient
    .from("User_Profiles")
    .select("profile_embedding")
    .eq("user_id", userId)
    .single();
  const userEmbeddingRaw = userVector?.profile_embedding as number[] | undefined;
  if (!userEmbeddingRaw || userVectorError) throw new Error("User embedding not found");

  // ensure film embedding exists
  const exists = await checkFilmExists({ supabaseClient, filmId });
  if (!exists) await generateFilmEmbedding({ filmId });

  // fetch film embedding
  const { data: filmVector, error: filmVectorError } = await supabaseClient
    .from("Film")
    .select("film_embedding")
    .eq("film_id", filmId)
    .single();
  const filmEmbeddingRaw = filmVector?.film_embedding as number[] | undefined;
  if (!filmEmbeddingRaw || filmVectorError) throw new Error("Film embedding not found");

  const userEmbedding = new Float32Array(userEmbeddingRaw);
  const filmEmbedding = new Float32Array(filmEmbeddingRaw);

  if (!userEmbedding || !filmEmbedding) {
    throw new Error("Embeddings not found");
  }

  if (userEmbedding.length !== filmEmbedding.length) {
    throw new Error("Embedding dimension mismatch");
  }
  // compute prediction
  const prediction = computeDotProduct({ u: userEmbedding, m: filmEmbedding });
  const error = confidence * (normalizedRating - prediction);

  // update user embedding
  const updatedUser = new Float32Array(userEmbedding.length);
  for (let i = 0; i < userEmbedding.length; i++) {
    updatedUser[i] =
      userEmbedding[i]! + learningRate * (error * filmEmbedding[i]! - lambda * userEmbedding[i]!);
  }

  const { data, error: updateError } = await supabaseClient
    .from("User_Profiles")
    .update({ profile_embedding: Array.from(updatedUser) })
    .eq("user_id", userId);
  if (updateError) throw new Error("Failed to update user embedding");
  const rows = data as any[] | null | undefined;
  if (!rows || rows.length === 0) throw new Error("No rating found to update");
};

// Remove Rating, shift back the user embedding accordingly
export const deleteRating = async ({ ratingId, userId, supabaseClient }: DeleteRatingType) => {
  // Verify rating belongs to user
  const { data: rating, error: fetchError } = await supabaseClient
    .from("Ratings")
    .select("user_id")
    .eq("rating_id", ratingId)
    .single();

  if (fetchError || !rating) throw new Error("Rating not found");
  if (rating.user_id !== userId) throw new Error("Unauthorized");

  const { error: deleteError } = await supabaseClient
    .from("Ratings")
    .delete()
    .eq("rating_id", ratingId);
  
  if (deleteError) throw new Error("Failed to delete rating");
};

export const updateRating = async ({
  ratingId,
  userId,
  newRating,
  supabaseClient,
}: UpdateRatingType) => {
  // Verify rating belongs to user
  const { data: rating, error: fetchError } = await supabaseClient
    .from("Ratings")
    .select("*")
    .eq("rating_id", ratingId)
    .single();

  if (fetchError || !rating) throw new Error("Rating not found");
  if (rating.user_id !== userId) throw new Error("Unauthorized");

  // Update the rating
  const { error: updateError } = await supabaseClient
    .from("Ratings")
    .update({ rating: newRating })
    .eq("rating_id", ratingId);

  if (updateError) throw new Error("Failed to update rating");

  // Recalculate user embedding (same as insertRating)
  const normalizedRating = (newRating - 3) / 2;
  const confidence = confidenceMap[newRating] ?? 0.5;

  const { data: userVector } = await supabaseClient
    .from("User_Profiles")
    .select("profile_embedding")
    .eq("user_id", userId)
    .single();

  const { data: filmVector } = await supabaseClient
    .from("Film")
    .select("film_embedding")
    .eq("film_id", rating.film_id)
    .single();

  if (!userVector?.profile_embedding || !filmVector?.film_embedding) {
    throw new Error("Embeddings not found");
  }

  const userEmbedding = new Float32Array(userVector.profile_embedding as number[]);
  const filmEmbedding = new Float32Array(filmVector.film_embedding as number[]);

  const prediction = computeDotProduct({ u: userEmbedding, m: filmEmbedding });
  const error = confidence * (normalizedRating - prediction);

  const updatedUser = new Float32Array(userEmbedding.length);
  for (let i = 0; i < userEmbedding.length; i++) {
    updatedUser[i] =
      userEmbedding[i]! + learningRate * (error * filmEmbedding[i]! - lambda * userEmbedding[i]!);
  }

  const { error: embedError } = await supabaseClient
    .from("User_Profiles")
    .update({ profile_embedding: Array.from(updatedUser) })
    .eq("user_id", userId);

  if (embedError) throw new Error("Failed to update user embedding");
};

export const handleLike = async ({
  userId,
  filmId,
  name,
  genre
}: KafkaEvent) => {
  try {
    await sendEventToKafka("recommendation-likes", {
      userId,
      filmId,
      timestamp: new Date().toISOString(),
      type: "like",
      name,
      genre
    });
  } catch (err) {
    console.error("Failed to log recommendation like:", err);
  }
}

export const handleClick = async ({
  userId,
  filmId,
  name,
  genre,
}: KafkaEvent) => {
  try {
    await sendEventToKafka("recommendation-clicks", {
      userId,
      filmId,
      timestamp: new Date().toISOString(),
      type: "click",
      name,
      genre
    });
    
  } catch (err) {
    console.error("Failed to log recommendation click:", err);
  }
}

// Click and view for 5 seconds or more counts as an impression
export const handleImpression = async ({
  userId,
  filmId,
  name,
  genre,
}: KafkaEvent) => {
  try {
    await sendEventToKafka("recommendation-impressions", {
      userId,
      filmId,
      timestamp: new Date().toISOString(),
      type: "impression",
      name,
      genre
    }); 
  } catch (err) {
    console.error("Failed to log recommendation impression:", err);
  }
}
