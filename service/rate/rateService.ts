import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

type SelectRatingType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
};

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
  newRating: number;
};

type DeleteRatingType = {
  supabaseClient: SupabaseClient;
  ratingId: UUID;
};

type VectorType = Float32Array;

type DotProductType = {
  u: VectorType;
  m: VectorType;
};

const computeDotProduct = ({ u, m }: DotProductType): number => {
  if (u.length !== m.length) {
    throw new Error("Vector dimension mismatch");
  }
  let sum = 0;
  for (let i = 0; i < u.length; i++) {
    sum += u[i]! * m[i]!;
  }
  return sum;
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
  rating,
  note,
  userId,
  filmId,
}: InsertRatingType) => {
  const learningRate = 0.01;

  const { error: insertionError } = await supabaseClient
    .from("Ratings")
    .insert({ user_id: userId, rating, note, film_id: filmId });

  if (insertionError) {
    throw new Error("Failed To Insert Rating");
  }

  // Fetch User Vector
  const { data: userVector, error: userVectorFetchError } = await supabaseClient
    .from("User_Profiles")
    .select("profile_embedding")
    .eq("user_id", userId)
    .single();

  // Fetch Film Embeddings
  const { data: filmVector, error: filmVectorFetchError } =
    await supabaseClient
      .from("Film")
      .select("film_embedding")
      .eq("film_id", filmId)
      .single();

  // Check for errors and missing data
  if (userVectorFetchError || filmVectorFetchError) {
    throw new Error("Failed to fetch embeddings");
  }

  if (!userVector || !filmVector) {
    throw new Error("Missing embedding data");
  }

  if (!userVector.profile_embedding || !filmVector.film_embedding) {
    throw new Error("Missing embedding fields");
  }

  const profileEmbedding = new Float32Array(userVector.profile_embedding);
  const filmEmbedding = new Float32Array(filmVector.film_embedding);

  // Validate embeddings
  if (profileEmbedding.length === 0 || filmEmbedding.length === 0) {
    throw new Error("Embeddings cannot be empty");
  }

  if (profileEmbedding.length !== filmEmbedding.length) {
    throw new Error("Embedding dimension mismatch");
  }

  // Compute dot product
  const dotProduct = computeDotProduct({
    u: profileEmbedding,
    m: filmEmbedding,
  });

  const error = rating - dotProduct;

  // Update user vector using gradient descent
  const newVector = new Float32Array(profileEmbedding.length);
  for (let i = 0; i < profileEmbedding.length; i++) {
    newVector[i] = profileEmbedding[i]! + error * learningRate * filmEmbedding[i]!;
  }

  // Update database
  const { error: vectorInsertionError } = await supabaseClient
    .from("User_Profiles")
    .update({ profile_embedding: Array.from(newVector) })
    .eq("user_id", userId);

  if (vectorInsertionError) {
    throw new Error("Failed To Update Vector");
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
    .update({ rating: newRating })
    .eq("user_id", userId);

  if (updateError) {
    throw new Error("Failed to Update");
  }
};