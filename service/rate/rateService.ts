import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

type InsertRatingType = {
  supabaseClient: SupabaseClient;
  rating: Number;
  note: String;
  userId: UUID;
  filmId: Number;
};

type SelectRatingType = {
    supabaseClient: SupabaseClient
    userId: UUID
}

export const getRatings = async ({userId, supabaseClient}: SelectRatingType) => {
    const { data: ratingData, error: selectionError } = await supabaseClient
        .from("Ratings")
        .select()
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (selectionError) {
        throw new Error("Failed To Select Data")
    }
    return ratingData
}

export const insertRating = async ({
  supabaseClient,
  rating,
  note,
  userId,
  filmId
}: InsertRatingType) => {
  const { error: insertionError } = await supabaseClient
    .from("Ratings")
    .insert({ user_id: userId, rating, note, film_id: filmId });
  if (insertionError) {
    throw new Error("Failed To Insert")
  }
};

export const updateRating = async ({}) => {

}