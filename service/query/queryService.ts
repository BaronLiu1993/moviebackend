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
  limit?: number;
  offset?: number;
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
  try {
    const { error } = await supabaseClient.from("bookmarks").insert({
      user_id: userId,
      film_id: filmId,
    });

    if (error) {
      console.error(`[bookmarkFilm] Error bookmarking film ${filmId} for user ${userId}:`, error);
      throw new Error(`Failed to bookmark film: ${error.message}`);
    }
  } catch (err) {
    console.error(`[bookmarkFilm] Exception:`, err);
    throw err;
  }
};


//Generate feed for users precompute -> cache -> fetch from cache (Redis) -> fallback to real-time computation if cache miss


// Returns personalized film recommendations based on user embeddings
// Deprecated: Use getRecommendedFilms instead which includes pagination
export const getRecommendedFilms = async ({
  supabaseClient,
  userId,
  limit = 20,
  offset = 0,
}: UserRequest) => {
  try {
    console.log(`[getRecommendedFilms] Fetching recommendations for user: ${userId} (limit: ${limit}, offset: ${offset})`);
    const { data, error } = await supabaseClient.rpc("get_recommended", {
      user_id: userId,
      limit_count: limit,
      offset_count: offset,
    });


    if (error) {
      console.error(`[getRecommendedFilms] RPC error for user ${userId}:`, error);
      throw new Error(`Failed to fetch recommended films: ${error.message}`);
    }

    console.log(`[getRecommendedFilms] Successfully fetched ${data?.length || 0} recommendations`);
    return data;
  } catch (err) {
    console.error(`[getRecommendedFilms] Exception:`, err);
    throw err;
  }
};

// Returns films that a user's friends are watching or rating
export const getFriendFilms = async ({
  supabaseClient,
  userId,
}: UserRequest) => {
  try {
    console.log(`[getFriendFilms] Fetching friend films for user: ${userId}`);
    
    const { data, error } = await supabaseClient.rpc("get_friends_films", {
      user_id: userId,
    });

    if (error) {
      console.error(`[getFriendFilms] RPC error for user ${userId}:`, error);
      throw new Error(`Failed to fetch friend films: ${error.message}`);
    }

    console.log(`[getFriendFilms] Successfully fetched ${data?.length || 0} friend films`);
    return data;
  } catch (err) {
    console.error(`[getFriendFilms] Exception:`, err);
    throw err;
  }
};

// Fetches currently airing Korean dramas from TMDB
export const getCurrentlyAiringDramas = async () => {
  try {
    console.log(`[getCurrentlyAiringKoreanDramas] Fetching currently airing Korean dramas`);
    
    const today = new Date().toISOString().split("T")[0] || "";
    const params = new URLSearchParams({
      with_origin_country: "KR",
      sort_by: "first_air_date.desc",
      "air_date.gte": today,
      include_adult: "false",
      language: "en-US",
      page: "1",
    });

    const response = await fetch(
      `${TMDB_API_BASE}/3/discover/tv?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${TMDB_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[getCurrentlyAiringKoreanDramas] TMDB API error - Status: ${response.status}`, response.statusText);
      throw new Error(`Failed to fetch currently airing Korean dramas: HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`[getCurrentlyAiringKoreanDramas] Successfully fetched ${data?.results?.length || 0} dramas`);
    return data;
  } catch (err) {
    console.error(`[getCurrentlyAiringKoreanDramas] Exception:`, err);
    throw err;
  }
};

// Fetches popular Korean dramas from TMDB
export const getPopularDramas = async () => {
  try {
    console.log(`[getPopularKoreanDramas] Fetching popular Korean dramas`);
    
    const params = new URLSearchParams({
      with_origin_country: "KR",
      sort_by: "popularity.desc",
      include_adult: "false",
      language: "en-US",
      "first_air_date.gte": "2016-01-01",
      "first_air_date.lte": "2026-12-31",
      page: "1",
    });

    const response = await fetch(
      `${TMDB_API_BASE}/3/discover/tv?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${TMDB_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[getPopularKoreanDramas] TMDB API error - Status: ${response.status}`, response.statusText);
      throw new Error(`Failed to fetch popular Korean dramas: HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`[getPopularKoreanDramas] Successfully fetched ${data?.results?.length || 0} dramas`);
    return data;
  } catch (err) {
    console.error(`[getPopularKoreanDramas] Exception:`, err);
    throw err;
  }
};
