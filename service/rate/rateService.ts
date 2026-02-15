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
type DeleteRatingType = {
  supabaseClient: SupabaseClient;
  ratingId: UUID;
  userId: UUID;
};
type EmbeddingRequestType = { filmId: number };
type VectorType = Float32Array;
type DotProductType = { u: VectorType; m: VectorType };

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

  const { error: insertionError } = await supabaseAdmin.from("Film").insert({
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

// Fix this so that the insert rating has better vector calculations and chunking as well.
export const insertRating = async ({
  supabaseClient,
  rating,
  note,
  userId,
  filmId,
}: InsertRatingType) => {
  const { error: insertError } = await supabaseClient.from("Ratings").insert({
    user_id: userId,
    rating,
    note,
    film_id: filmId,
  });
  
  if (insertError) throw new Error("Failed to insert rating");
};

// Remove Rating, shift back the user embedding accordingly
export const deleteRating = async ({
  ratingId,
  userId,
  supabaseClient,
}: DeleteRatingType) => {
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
    .select("user_id")
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
};
