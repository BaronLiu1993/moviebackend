/*
 * It combines Supabase RPCs and tables with OpenAI embeddings
 * and TMDB metadata to manage personalized film recommendations.
*/

import { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
import { handleRating } from "../analytics/analyticsService.js";
import updateEmbeddingQueue from "../../queue/updateEmbedding.ts/updateEmbeddingQueue.js";

// types
type SelectRatingType = { supabaseClient: SupabaseClient; userId: UUID };
type InsertRatingType = {
  supabaseClient: SupabaseClient;
  rating: number;
  note: string;
  userId: UUID;
  filmId: number;
  name: string;
  genre: string[];
  accessToken: string;
};
type UpdateRatingType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  ratingId: UUID;
  newRating: number;
  newNote: string;  
  accessToken: string;
};
type DeleteRatingType = {
  supabaseClient: SupabaseClient;
  ratingId: UUID;
  userId: UUID;
  accessToken: string;
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
  name,
  genre,
  userId,
  filmId,
  accessToken,
}: InsertRatingType) => {

  // Add data base constraint the combination of user_id and film_id must be unique
  const { error: insertError } = await supabaseClient.from("Ratings").insert({
    user_id: userId,
    rating,
    note,
    film_id: filmId,
  });
  await handleRating({ userId, filmId, rating, name, genre });

  if (insertError) throw new Error("Failed to insert rating");
  await updateEmbeddingQueue.add('recompute', { userId, accessToken });
  return true;
};

export const deleteRating = async ({
  ratingId,
  userId,
  supabaseClient,
  accessToken,
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
  await updateEmbeddingQueue.add('recompute', { userId, accessToken});
  return true;
};

export const updateRating = async ({
  ratingId,
  userId,
  newRating,
  supabaseClient,
  accessToken,
  newNote,
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
    .update({ rating: newRating, note: newNote })
    .eq("rating_id", ratingId);

  if (updateError) throw new Error("Failed to update rating");
  await updateEmbeddingQueue.add('recompute', { userId, accessToken });
  return true;
};
