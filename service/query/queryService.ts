import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;

/* Types */

type SupabaseRequest = {
  supabaseClient: SupabaseClient;
};

type UserRequest = SupabaseRequest & {
  userId: UUID;
};

type BookmarkRequest = UserRequest & {
  filmId: number;
};

type SimilaritySearchRequest = SupabaseRequest & {
  query: string;
};

type RelatedFilmRequest = {
  genres: string;
  countries: string;
};

/* Service Functions */

// Bookmark a film for a user
export const bookmarkFilm = async ({
  supabaseClient,
  userId,
  filmId,
}: BookmarkRequest): Promise<void> => {
  const { error } = await supabaseClient.from("bookmarks").insert({
    user_id: userId,
    film_id: filmId,
  });

  if (error) {
    throw new Error("Failed to bookmark film");
  }
};

// Get personalized film recommendations based on user embeddings
export const getRecommendedFilms = async ({
  supabaseClient,
  userId,
}: UserRequest) => {
  const { data, error } = await supabaseClient.rpc("get_recommended", {
    user_id: userId,
  });

  if (error) {
    throw new Error("Failed to fetch recommended films");
  }

  return data;
};

// Get films friends are watching or rating
export const getFriendFilms = async ({
  supabaseClient,
  userId,
}: UserRequest) => {
  const { data, error } = await supabaseClient.rpc("get_friends_films", {
    user_id: userId,
  });

  if (error) {
    throw new Error("Failed to fetch friend films");
  }

  return data;
};

// Search for films similar to a text query using embeddings
export const getSimilarFilms = async ({
  supabaseClient,
  query,
}: SimilaritySearchRequest) => {
  const { data, error } = await supabaseClient.rpc("get_similar_films", {
    query,
  });

  if (error) {
    throw new Error("Failed to fetch similar films");
  }

  return data;
};

// Fetch related films from TMDB based on genres and origin countries
export const getRelatedFilms = async ({
  genres,
  countries,
}: RelatedFilmRequest) => {
  const response = await fetch(
    `${TMDB_API_BASE}/3/discover/movie?with_genres=${genres}&with_origin_country=${countries}&page=1`,
    {
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch related films");
  }

  return response.json();
};
