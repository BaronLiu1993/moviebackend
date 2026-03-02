/*
 * It acts as the film discovery and recommendation service layer,
 * combining Supabase RPCs with external TMDB data.
*/

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

// config
const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;

// MMR config
const MMR_LAMBDA = 0.8; 
const MMR_FINAL_COUNT = 75; 

type Film = {
  tmdb_id: number;
  title: string;
  release_year: string;
  film_id?: string;
  genre_ids: number[];
  similarity?: number;
  photo_url?: string;
};

type UserRequest = {
  supabaseClient: SupabaseClient;
  userId: UUID;
};

/**
 * MMR (Maximal Marginal Relevance) reranking for diversity.
 * MMR = λ * relevance(item) - (1-λ) * max_similarity(item, selected_items)
 * Uses genre overlap as diversity metric (Jaccard similarity).
 */
const applyMMR = (
  candidates: Film[],
  finalCount: number,
  lambda: number = MMR_LAMBDA
): Film[] => {
  if (candidates.length <= finalCount) return candidates;

  const selected: Film[] = [];
  const remaining = [...candidates];

  // Jaccard similarity between two genre arrays
  const genreSimilarity = (a: number[], b: number[]): number => {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union > 0 ? intersection / union : 0;
  };

  const first = remaining.shift();
  if (!first) return selected;
  selected.push(first);

  while (selected.length < finalCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const relevance = candidate.similarity ?? 0;

      const maxSimToSelected = Math.max(
        ...selected.map(s => genreSimilarity(candidate.genre_ids, s.genre_ids))
      );

      // MMR score
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimToSelected;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    const next = remaining.splice(bestIdx, 1)[0];
    if (next) selected.push(next);
  }

  return selected;
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
      supabaseClient.rpc("get_recommended_films", {
        p_user_id: userId,
        limit_count: 300,
        offset_count: 0,  
      }),
      getPopularDramas(),
      getAiringDramas() 
    ]);

    console.log('[getInitialFeed] RPC result:', recommendedResult);

    const { data, error } = recommendedResult;

    if (error) {
      throw new Error(`Failed to fetch recommended films: ${error.message}`);
    }

    const standardizedPopular = (popularData.results || []).map((item: any) => ({
      tmdb_id: item.id,
      title: item.name,
      release_year: item.first_air_date?.split('-')[0] || null,
      genre_ids: item.genre_ids || [],
      photo_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null
    }));
    
    const standardizedAiring = (airingData.results || []).map((item: any) => ({
      tmdb_id: item.id,
      title: item.name,
      release_year: item.first_air_date?.split('-')[0] || null,
      genre_ids: item.genre_ids || [],
      photo_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null
    }));
    
    const seen = new Set<number>();
    const combined = [
      ...(data || []),
      ...standardizedPopular,
      ...standardizedAiring
    ].filter((item: any) => {
      if ((item.tags || []).includes(99)) return false;
      if (seen.has(item.tmdb_id)) return false;
      seen.add(item.tmdb_id);
      return true;
    });
    
    // Apply MMR for diversity
    const result = applyMMR(combined as Film[], MMR_FINAL_COUNT, MMR_LAMBDA);
    console.log(`[getInitialFeed] Total records: ${result.length} (before MMR: ${combined.length}, personalized: ${data?.length || 0}, popular: ${standardizedPopular.length}, airing: ${standardizedAiring.length})`);
    
    return result;
  } catch (err) {
    console.error(`[getInitialFeed] Exception:`, err);
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

export const getCollaborativeFilters = async ({
  supabaseClient,
  userId,
}: UserRequest) => {
  try {
    console.log(`[getCollaborativeFilters] Fetching collaborative filters for user: ${userId}`);
    const { data, error } = await supabaseClient.rpc("get_collaborative_filters", {
      user_id: userId,
      limit_count: 20,
      offset_count: 0,
    });

    if (error) {
      throw new Error(`Failed to fetch collaborative filters: ${error.message}`);
    }

    console.log(`[getCollaborativeFilters] Successfully fetched ${data?.length || 0} collaborative filters`);
    return data;
  } catch (err) {
    console.error(`[getCollaborativeFilters] Exception:`, err);
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
