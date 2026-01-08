import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

type SelectRatingType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
};

type InsertRatingType = {
  supabaseClient: SupabaseClient;
  rating: Number;
  note: String;
  userId: UUID;
  filmId: Number;
};

type UpdateRatingType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  newRating: Number;
};

type DeleteRatingType = {
  supabaseClient: SupabaseClient;
  ratingId: UUID;
};

export const getRatings = async ({
  userId,
  supabaseClient,
}: SelectRatingType) => {
  const { data: ratingData, error: selectionError } = await supabaseClient
    .from("Ratings")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (selectionError) {
    throw new Error("Failed To Select Data");
  }
  return ratingData;
};

export const insertRating = async ({
  supabaseClient,
  rating, // Their rating
  note, // Note diary
  userId, // User who posted
  filmId, // Film they are rating
}: InsertRatingType) => {
  const { error: insertionError } = await supabaseClient
    .from("Ratings")
    .insert({ user_id: userId, rating, note, film_id: filmId });

  if (insertionError) {
    throw new Error("Failed To Insert");
  }
};

export const deleteRating = async ({
  ratingId,
  supabaseClient,
}: DeleteRatingType) => {
  const { error: deletionError } = await supabaseClient
    .from("Ratings")
    .delete()
    .eq("rating_id", ratingId);

  if (deletionError) {
    throw new Error("Deleting Error");
  }
};

export const updateRating = async ({
  userId,
  supabaseClient,
  newRating,
}: UpdateRatingType) => {
  const { error: updateError } = await supabaseClient
    .from("Ratings")
    .upsert({ rating: newRating })
    .eq("user_id", userId);

  if (updateError) {
    throw new Error("Failed to Update");
  }
};
