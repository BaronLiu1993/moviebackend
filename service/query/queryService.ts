/*
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
};

//Generate feed for users precompute -> cache -> fetch from cache (Redis) -> fallback to real-time computation if cache miss


// Returns personalized film recommendations based on user embeddings, with pagination support
export const getInitialFeed = async ({
  supabaseClient,
  userId,
}: UserRequest) => {
  try {
    console.log(`[getInitialFeed] Fetching initial feed for user`);
    
    const [recommendedResult, popularData, airingData] = await Promise.all([
      supabaseClient.rpc("get_recommended", {
        user_id: userId,
        limit_count: 100,
        offset_count: 0,
      }),
      getPopularDramas(),
      getAiringDramas()
    ]);

    const { data, error } = recommendedResult;

    console.log(popularData)

    if (error) {
      throw new Error(`Failed to fetch recommended films: ${error.message}`);
    }

    
    const standardizedPopular = (popularData.results || []).map((item: any) => ({
      tmdb_id: item.id,
      title: item.name,
      release_year: item.first_air_date?.split('-')[0] || null,
      tags: item.genre_ids || []
    }));
    
    const standardizedAiring = (airingData.results || []).map((item: any) => ({
      tmdb_id: item.id,
      title: item.name,
      release_year: item.first_air_date?.split('-')[0] || null,
      tags: item.genre_ids || []
    }));
    
    const result = [
      ...(data || []),
      ...standardizedPopular,
      ...standardizedAiring
    ];
    
    console.log(`[getInitialFeed] Total records: ${result.length} (personalized: ${data?.length || 0}, popular: ${standardizedPopular.length}, airing: ${standardizedAiring.length})`);
    
    return result;
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
    const today = new Date().toISOString().split("T")[0] || "";
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startDate = threeMonthsAgo.toISOString().split("T")[0] || "";
    
    const params = new URLSearchParams({
      with_origin_country: "KR",
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
      with_origin_country: "KR",
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
    return data;
  } catch (err) {
    throw err;
  }
};
