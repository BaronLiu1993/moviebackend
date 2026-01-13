import { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
import OpenAI from "openai";
import dotenv from "dotenv";
import { createServerSideSupabaseClient } from "../supabase/configureSupabase.js";

dotenv.config();

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const TMDB_API_BASE = process.env.TMDB_API_BASE;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Types
type RatingType = {
  supabaseClient: SupabaseClient;
  filmId: number;
};

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

type EmbeddingRequestType = {
  filmId: number;
};

type VectorType = Float32Array;

type DotProductType = {
  u: VectorType;
  m: VectorType;
};

// OpenAI Client + Supabase Admin Client
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

const checkFilmExists = async ({
  supabaseClient,
  filmId,
}: RatingType): Promise<boolean> => {
  const { error } = await supabaseClient
    .from("")
    .select("film_id")
    .eq("film_id", filmId);

  if (error) {
    return false;
  }

  return true;
};

const generateFilmEmbedding = async ({ filmId }: EmbeddingRequestType) => {
  const [movieMetdata, movieKeywords] = await Promise.all([
    fetch(`${TMDB_API_BASE}/3/movie/${filmId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
      },
    }),
    fetch(`${TMDB_API_BASE}/3/movie/${filmId}/keywords`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
      },
    }),
  ]);

  const [movieMetadataJson, movieKeywordsJson] = await Promise.all([
    movieMetdata.json(),
    movieKeywords.json(),
  ]);

  let inputString = "";
  for (let i = 0; i < movieMetadataJson.genres.length; i++) {
    inputString += movieMetadataJson.genres[i].name;
  }

  for (let i = 0; i < movieKeywordsJson.keywords.length; i++) {
    inputString += movieKeywordsJson.keywords[i].name;
  }

  const response = await OpenAIClient.embeddings.create({
    model: "text-embedding-3-small",
    input: inputString,
    encoding_format: "float",
  });

  // Use Supabase Client
  const { error: insertionError } = await supabaseAdmin
    .from("Guanghai")
    .insert({
      film_embedding: response.data[0]?.embedding,
      title: movieMetadataJson.name,
      release_year: movieMetadataJson.release_date,
    });

  if (insertionError) {
    throw new Error("Failed to Insert");
  }
};

export const selectRatings = async ({
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
  const normalizedRating = (rating - 3) / 2;
  const confidence = confidenceMap[rating] ?? 0.5;
  
  const { error: insertionError } = await supabaseClient
    .from("Ratings")
    .insert({
      user_id: userId,
      rating,
      note,
      film_id: filmId,
    });
    
  if (insertionError) {
    throw new Error("Failed To Insert Rating");
  }
  
  const { data: userVector, error: userVectorFetchError } = await supabaseClient
    .from("User_Profiles")
    .select("profile_embedding")
    .eq("user_id", userId)
    .single();
    
  if (userVectorFetchError || !userVector?.profile_embedding) {
    throw new Error("Failed to fetch user embedding");
  }
  
  const exists = await checkFilmExists({ supabaseClient, filmId });
  if (!exists) {
    await generateFilmEmbedding({ filmId });
  }
  
  const { data: filmVector, error: filmVectorFetchError } = await supabaseClient
    .from("Film")
    .select("film_embedding")
    .eq("film_id", filmId)
    .single();
    
  if (filmVectorFetchError || !filmVector?.film_embedding) {
    throw new Error("Failed to fetch film embedding");
  }
  
  const userEmbeddingRaw = userVector.profile_embedding;
  const filmEmbeddingRaw = filmVector.film_embedding;
  
  if (!Array.isArray(userEmbeddingRaw) || !Array.isArray(filmEmbeddingRaw)) {
    throw new Error("Invalid embedding format");
  }
  
  const userEmbedding = new Float32Array(userEmbeddingRaw);
  const filmEmbedding = new Float32Array(filmEmbeddingRaw);
  
  if (userEmbedding.length === 0 || filmEmbedding.length === 0) {
    throw new Error("Embeddings cannot be empty");
  }
  
  if (userEmbedding.length !== filmEmbedding.length) {
    throw new Error("Embedding dimension mismatch");
  }
  
  const prediction = computeDotProduct({
    u: userEmbedding,
    m: filmEmbedding,
  });
  
  const error = confidence * (normalizedRating - prediction);
  
  const updatedUser = new Float32Array(userEmbedding.length);
  const updatedFilm = new Float32Array(filmEmbedding.length);
  
  for (let i = 0; i < userEmbedding.length; i++) {
    updatedUser[i] =
      userEmbedding[i] +
      learningRate * (error * filmEmbedding[i] - lambda * userEmbedding[i]);
      
    updatedFilm[i] =
      filmEmbedding[i] +
      learningRate * (error * userEmbedding[i] - lambda * filmEmbedding[i]);
  }
  
  // Persist user update
  const { error: userUpdateError } = await supabaseClient
    .from("User_Profiles")
    .update({ profile_embedding: Array.from(updatedUser) })
    .eq("user_id", userId);
    
  if (userUpdateError) {
    throw new Error("Failed to update user embedding");
  }
  
  // Persist film update
  const { error: filmUpdateError } = await supabaseClient
    .from("Film")
    .update({ film_embedding: Array.from(updatedFilm) })
    .eq("film_id", filmId);
    
  if (filmUpdateError) {
    throw new Error("Failed to update film embedding");
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
