/*
 * It combines Supabase RPCs and tables with OpenAI embeddings
 * and TMDB metadata to manage personalized film recommendations.
*/

import { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
import { handleRating } from "../analytics/analyticsService.js";
import updateEmbeddingQueue from "../../queue/updateEmbedding/updateEmbeddingQueue.js";

// types
type SelectRatingType = { 
  supabaseClient: SupabaseClient; 
  userId: UUID 
};

type InsertRatingType = {
  supabaseClient: SupabaseClient;
  rating: number;
  note: string;
  userId: UUID;
  tmdbId: number;
  name: string;
  genre_ids: number[];
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
  genre_ids,
  userId,
  tmdbId,
  accessToken,
}: InsertRatingType) => {

  const { data: existingRating, error: fetchError } = await supabaseClient
    .from("Ratings")
    .select("rating_id")
    .eq("user_id", userId)
    .eq("tmdb_id", tmdbId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error(`[insertRating] Error checking existing rating for user ${userId} and film ${tmdbId}:`, fetchError);
    throw new Error("Failed to check existing rating");
  }

  if (existingRating) {
    throw new Error("User has already rated this film");
  }

  // Add data base constraint the combination of user_id and film_id must be unique
  const { error: insertError } = await supabaseClient.from("Ratings").insert({
    user_id: userId,
    rating: rating,
    note: note,
    film_name: name,
    tmdb_id: tmdbId,
    genre_ids: genre_ids
  });

  console.log(insertError)
  if (insertError) throw new Error("Failed to insert rating");
  await handleRating({ userId, tmdbId, rating, film_name: name, genre_ids });
  console.log("[rateService] handleRating called for", { userId, tmdbId, rating });
  await updateEmbeddingQueue.add('recompute', { userId, accessToken, operation: 'insert', tmdbId, rating });
};

export const deleteRating = async ({
  ratingId,
  userId,
  supabaseClient,
  accessToken,
}: DeleteRatingType) => {
  // Verify rating belongs to user and fetch film_id + rating for incremental update
  const { data: ratingData, error: fetchError } = await supabaseClient
    .from("Ratings")
    .select("user_id, tmdb_id, rating")
    .eq("rating_id", ratingId)
    .single();

  if (fetchError || !ratingData) throw new Error("Rating not found");
  if (ratingData.user_id !== userId) throw new Error("Unauthorized");

  const { error: deleteError } = await supabaseClient
    .from("Ratings")
    .delete()
    .eq("rating_id", ratingId);

  if (deleteError) throw new Error("Failed to delete rating");

  await handleRating({ userId, tmdbId: ratingData.tmdb_id, rating: 0 });
  await updateEmbeddingQueue.add('recompute', {
    userId,
    accessToken,
    operation: 'delete',
    tmdbId: ratingData.tmdb_id,
    rating: ratingData.rating,
  });
};

export const updateRating = async ({
  ratingId,
  userId,
  newRating,
  supabaseClient,
  accessToken,
  newNote,
}: UpdateRatingType) => {
  // Verify rating belongs to user and fetch film_id + old rating for incremental update
  const { data: ratingData, error: fetchError } = await supabaseClient
    .from("Ratings")
    .select("user_id, tmdb_id, rating")
    .eq("rating_id", ratingId)
    .single();

  if (fetchError || !ratingData) throw new Error("Rating not found");
  if (ratingData.user_id !== userId) throw new Error("Unauthorized");

  // Update the rating
  const { error: updateError } = await supabaseClient
    .from("Ratings")
    .update({ rating: newRating, note: newNote })
    .eq("rating_id", ratingId);

  if (updateError) throw new Error("Failed to update rating");

  await handleRating({ userId, tmdbId: ratingData.tmdb_id, rating: newRating });
  await updateEmbeddingQueue.add('recompute', {
    userId,
    accessToken,
    operation: 'update',
    tmdbId: ratingData.tmdb_id,
    rating: newRating,
    oldRating: ratingData.rating,
  });
};
