/**
 * It acts as the film discovery and recommendation service layer,
 * combining Supabase RPCs with external TMDB data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

// config
const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;


type UserRequest = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  limit?: number;
  offset?: number;
};

type BookmarkRequest = UserRequest & {
  filmId: number;
};

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

export const removeBookmark = async ({
  supabaseClient,
  userId,
  filmId,
}: BookmarkRequest): Promise<void> => {
  try {
    const { error } = await supabaseClient
      .from("bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("film_id", filmId);
      
    if (error) {
      console.error(`[unbookmarkFilm] Error unbookmarking film ${filmId} for user ${userId}:`, error);
      throw new Error(`Failed to unbookmark film: ${error.message}`);
    }
  } catch (err) {
    console.error(`[unbookmarkFilm] Exception:`, err);
    throw err;
  }
};


//Generate feed for users precompute -> cache -> fetch from cache (Redis) -> fallback to real-time computation if cache miss


// Returns personalized film recommendations based on user embeddings, with pagination support
export const getInitialFeed = async ({
  supabaseClient,
  userId,
  offset = 0,
}: UserRequest) => {
  try {
    console.log(`[getInitialFeed] Fetching initial feed for user`);
    
    const [recommendedResult, popularData, airingData] = await Promise.all([
      supabaseClient.rpc("get_recommended", {
        user_id: userId,
        limit_count: 100,
        offset_count: offset,
      }),
      getPopularDramas(),
      getAiringDramas()
    ]);

    const { data, error } = recommendedResult;

    if (error) {
      console.error(`[getRecommendedFilms] RPC error for user ${userId}:`, error);
      throw new Error(`Failed to fetch recommended films: ${error.message}`);
    }

    console.log(`[getRecommendedFilms] Successfully fetched ${data?.length || 0} recommendations`);
    return { 
      personalized: data, 
      popular: popularData.results || [],
      airing: airingData.results || []
    };
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
export const getAiringDramas = async () => {
  try {
    console.log(`[getCurrentlyAiringKoreanDramas] Fetching currently airing Korean dramas`);
    
    const today = new Date().toISOString().split("T")[0] || "";
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startDate = threeMonthsAgo.toISOString().split("T")[0] || "";
    
    const params = new URLSearchParams({
      with_origin_country: "KR,CN,JP",
      include_adult: "false",
      language: "en-US",
      page: "1",
      "air_date.gte": startDate,
      "air_date.lte": today,
      with_status: "0",
      without_genres: "10764,10763,10767,10762",
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
    return data;
  } catch (err) {
    throw err;
  }
};

// Fetches popular Korean dramas currently airing from TMDB
export const getPopularDramas = async () => {
  try {
    console.log(`[getPopularKoreanDramas] Fetching all-time popular Korean dramas`);
    
    const params = new URLSearchParams({
      with_origin_country: "CN",
      sort_by: "popularity.desc",
      include_adult: "false",
      language: "en-US",
      page: "1",
      without_genres: "10764,10763,10767,10762",
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
    console.log(`[getPopularKoreanDramas] Successfully fetched ${data?.results?.length || 0} currently airing dramas`);
    return data;
  } catch (err) {
    console.error(`[getPopularKoreanDramas] Exception:`, err);
    throw err;
  }
};
