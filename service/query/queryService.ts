/**
 * This module handles:
 * - Bookmarking films for users
 * - Fetching personalized film recommendations from Supabase (embeddings-based)
 * - Retrieving films friends are watching or rating
 * - Performing semantic film search using text embeddings
 * - Fetching related films from TMDB based on genre and country
 *
 * It acts as the film discovery and recommendation service layer,
 * combining Supabase RPCs with external TMDB data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

// config
const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;

// types
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
  fromYear: number;
  toYear: number;
};

// service functions
// Bookmarks a film for a user
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

// Returns personalized film recommendations based on user embeddings
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

// Returns films that a user's friends are watching or rating
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

// Performs a semantic search for films using text embeddings
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

// Fetches related films from TMDB using genres and origin countries
export const getRelatedFilms = async ({
  genres,
  countries,
  fromYear,
  toYear,
}: RelatedFilmRequest) => {
  // Build query parameters for discovering popular movies
  const params = new URLSearchParams({
    with_origin_country: countries,
    with_genres: genres,
    sort_by: "popularity.desc",
    "vote_count.gte": "300",
    include_adult: "false",
    page: "1",
    "primary_release_date.gte": `${fromYear}-01-01`,
    "primary_release_date.lte": `${toYear}-12-31`,
  });

  const response = await fetch(
    `${TMDB_API_BASE}/3/discover/movie?${params.toString()}`,
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
