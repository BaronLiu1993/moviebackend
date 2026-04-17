import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
import { insertInteractionEvents } from "../clickhouse/clickhouseService.js";
import { SIGNAL_VALUES } from "../clickhouse/signalValues.js";
import { reRankWithXGBoost } from "../ranking/rankingService.js";
import updateEmbeddingQueue from "../../queue/updateEmbedding/updateEmbeddingQueue.js";
import { Connection as redis } from "../../queue/redis/redis.js";
const FEED_CACHE_TTL_BASE = 3600;
const FEED_CACHE_JITTER = 300;
const FEED_CACHE_PREFIX = "feed:";

const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const RRF_K = 60;
const RRF_WEIGHTS = {
  recommended: 1.0,
  collaborative: 0.7,
  popular: 0.3,
  airing: 0.3,
} as const;
const DIVERSITY_PENALTY = 0.15;

export type FilmType = {
  tmdb_id: number;
  title: string;
  release_year: string;
  film_id?: string;
  genre_ids: number[];
  similarity?: number;
  photo_url?: string;
  media_type?: string;
};

type RecommendedFilmType = {
  tmdb_id: number;
  title: string;
  release_year: string;
  film_id: string;
  genre_ids: number[];
  similarity: number;
  photo_url: string | null;
  media_type: string;
};

type GetRecommendedFilmsRequestType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  limitCount: number;
  offsetCount: number;
};

type UserRequestType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
};

type GetFeedRequestType = UserRequestType & {
  page?: number;
  pageSize?: number;
};

type GetFeedResponseType = {
  films: FilmType[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

type LikeFilmType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  tmdbId: number;
  film_name: string;
  genre_ids: number[];
  accessToken: string;
};

type UnlikeFilmType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  tmdbId: number;
  accessToken: string;
};

export const likeFilm = async ({ supabaseClient, userId, tmdbId, film_name, genre_ids, accessToken }: LikeFilmType) => {
  try {
    const { error: insertError } = await supabaseClient
      .from("Film_Likes")
      .insert({ tmdb_id: tmdbId, user_id: userId });

    if (insertError) {
      if (insertError.code === "23505") throw new Error("Already liked this film");
      console.error(`[likeFilm] Error liking film ${tmdbId} for user ${userId}:`, insertError);
      throw new Error(`Failed to like film: ${insertError.message}`);
    }
    await supabaseClient.rpc("increment_film_like_count", { p_tmdb_id: tmdbId });
    await insertInteractionEvents({ userId, tmdbId, interactionType: "like", film_name, genre_ids, rating: SIGNAL_VALUES.LIKE });
    await updateEmbeddingQueue.add('recompute', { userId, accessToken, operation: 'insert', tmdbId, rating: SIGNAL_VALUES.LIKE });
  } catch (err) {
    console.error(`[likeFilm] Exception:`, err);
    throw err;
  }
};

export const unlikeFilm = async ({ supabaseClient, userId, tmdbId, accessToken }: UnlikeFilmType) => {
  try {
    const { error: deleteError } = await supabaseClient
      .from("Film_Likes")
      .delete()
      .eq("tmdb_id", tmdbId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error(`[unlikeFilm] Error unliking film ${tmdbId} for user ${userId}:`, deleteError);
      throw new Error(`Failed to unlike film: ${deleteError.message}`);
    }

    await supabaseClient.rpc("decrement_film_like_count", { p_tmdb_id: tmdbId });
    await insertInteractionEvents({ userId, tmdbId, interactionType: "like", rating: SIGNAL_VALUES.LIKE, is_positive: false });
    await updateEmbeddingQueue.add('recompute', { userId, accessToken, operation: 'delete', tmdbId, rating: SIGNAL_VALUES.LIKE });
  } catch (err) {
    console.error(`[unlikeFilm] Exception:`, err);
    throw err;
  }
};

const getRecommendedFilms = async ({
  supabaseClient,
  userId,
  limitCount,
  offsetCount,
}: GetRecommendedFilmsRequestType): Promise<RecommendedFilmType[]> => {
  const { data, error } = await supabaseClient.rpc("get_recommended_films", {
    p_user_id: userId,
    limit_count: limitCount,
    offset_count: offsetCount,
  });

  if (error) {
    throw new Error(`Failed to fetch recommended films: ${error.message}`);
  }

  return (data ?? []) as RecommendedFilmType[];
};


export const getCollaborativeFilters = async ({
  supabaseClient,
  userId,
}: UserRequestType) => {
  try {
    console.log(
      `[getCollaborativeFilters] Fetching collaborative filters for user: ${userId}`,
    );
    const { data: topKData, error: topKError } = await supabaseClient.rpc(
      "get_collaborative_filters",
      {
        user_id: userId
      },
    );

    if (topKError) {
      console.error(`[getCollaborativeFilters] Error fetching collaborative filters for user ${userId}:`, topKError);
      throw new Error(`Failed to fetch collaborative filters: ${topKError.message}`);
    }


    const films: { tmdb_id: number; rating: number; film_name: string; genre_ids: number[] }[] = [];
    for (const friendId of topKData) {
      const { data: friendFilms, error: friendFilmsError } = await supabaseClient
        .from("Ratings")
        .select("tmdb_id, rating, film_name, genre_ids")
        .eq("user_id", friendId)
        .gte("rating", 4)
        .limit(20);

      if (friendFilmsError || !friendFilms) {
        console.error(`[getCollaborativeFilters] Error fetching top-rated films for friend ${friendId}:`, friendFilmsError);
        continue;
      }
      films.push(...friendFilms);
    }
    
    console.log(
      `[getCollaborativeFilters] Successfully fetched ${films.length} collaborative filters`,
    );
    return films;
  } catch (err) {
    console.error(`[getCollaborativeFilters] Exception:`, err);
    throw new Error("Internal Server Error")
  }
};

const genreSimilarity = (a: number[], b: number[]): number => {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
};

type CollaborativeFilm = { tmdb_id: number; rating: number; film_name: string; genre_ids: number[] };

export const deduplicateCollaborative = (films: CollaborativeFilm[]): CollaborativeFilm[] => {
  const map = new Map<number, { totalRating: number; count: number; film_name: string; genre_ids: number[] }>();

  for (const film of films) {
    const existing = map.get(film.tmdb_id);
    if (existing) {
      existing.totalRating += film.rating;
      existing.count += 1;
    } else {
      map.set(film.tmdb_id, {
        totalRating: film.rating,
        count: 1,
        film_name: film.film_name,
        genre_ids: film.genre_ids,
      });
    }
  }

  return Array.from(map.entries())
    .map(([tmdb_id, val]) => ({
      tmdb_id,
      rating: val.totalRating / val.count,
      film_name: val.film_name,
      genre_ids: val.genre_ids,
    }))
    .sort((a, b) => b.rating - a.rating);
};

export type RankedList = {
  name: string;
  items: FilmType[];
};

export const applyRRF = (
  lists: RankedList[],
  k: number = RRF_K,
  weights: Record<string, number> = RRF_WEIGHTS,
): FilmType[] => {
  const scoreMap = new Map<number, { score: number; film: FilmType }>();

  for (const list of lists) {
    const w = weights[list.name] ?? 0;
    for (let rank = 0; rank < list.items.length; rank++) {
      const item = list.items[rank]!;
      const contribution = w / (k + rank + 1);
      const existing = scoreMap.get(item.tmdb_id);
      if (existing) {
        existing.score += contribution;
        if (!existing.film.film_id && item.film_id) existing.film = item;
      } else {
        scoreMap.set(item.tmdb_id, { score: contribution, film: item });
      }
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.film);
};

const applyGenreDiversity = (
  items: FilmType[],
  finalCount: number,
  penalty: number = DIVERSITY_PENALTY,
): FilmType[] => {
  if (items.length <= finalCount) return items;

  const selected: FilmType[] = [];
  const remaining = [...items];

  selected.push(remaining.shift()!);

  while (selected.length < finalCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestAdjustedScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const positionScore = 1 - i / remaining.length;
      const maxGenreOverlap = Math.max(
        ...selected.map((s) => genreSimilarity(candidate.genre_ids, s.genre_ids)),
      );
      const adjusted = positionScore - penalty * maxGenreOverlap;
      if (adjusted > bestAdjustedScore) {
        bestAdjustedScore = adjusted;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]!);
  }

  return selected;
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
      },
    );

    if (!response.ok) {
      console.error(
        `[getCurrentlyAiringKoreanDramas] TMDB API error - Status: ${response.status}`,
        response.statusText,
      );
      throw new Error(
        `Failed to fetch currently airing Korean dramas: HTTP ${response.status}`,
      );
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`[getCurrentlyAiringKoreanDramas] Exception:`, err);
    throw new Error(`Failed to fetch currently airing Korean dramas: ${err instanceof Error ? err.message : String(err)}`);
  }
};

// Fetches popular Korean dramas currently airing from TMDB
export const getPopularDramas = async () => {
  try {
    console.log(
      `[getPopularKoreanDramas] Fetching all-time popular Korean dramas`,
    );

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
      },
    );

    if (!response.ok) {
      console.error(
        `[getPopularKoreanDramas] TMDB API error - Status: ${response.status}`,
        response.statusText,
      );
      throw new Error(
        `Failed to fetch popular Korean dramas: HTTP ${response.status}`,
      );
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`[getPopularKoreanDramas] Exception:`, err);
    throw new Error(`Failed to fetch popular Korean dramas: ${err instanceof Error ? err.message : String(err)}`);
  }
};


const getFeedCacheKey = (userId: string) => `${FEED_CACHE_PREFIX}${userId}`;

const getFeedTTL = () => {
  const jitter = Math.floor(Math.random() * FEED_CACHE_JITTER * 2) - FEED_CACHE_JITTER;
  return FEED_CACHE_TTL_BASE + jitter;
};

const RPC_BATCH_SIZE = 300;
const MAX_POOL_SIZE = 300;

const buildCandidatePool = async ({
  supabaseClient,
  userId,
}: UserRequestType): Promise<FilmType[]> => {
  const [recommendedFilms, collaborativeFilms, popularData, airingData] = await Promise.all([
    getRecommendedFilms({ supabaseClient, userId, limitCount: RPC_BATCH_SIZE, offsetCount: 0 }),
    getCollaborativeFilters({ supabaseClient, userId }),
    getPopularDramas(),
    getAiringDramas(),
  ]);

  console.log(
    `[buildCandidatePool] RPC returned ${recommendedFilms.length} films, collaborative returned ${collaborativeFilms.length} films`,
  );

  const dedupedCollaborative = deduplicateCollaborative(collaborativeFilms);
  const standardizedCollaborative = dedupedCollaborative.map((item) => ({
    tmdb_id: item.tmdb_id,
    title: item.film_name,
    release_year: "",
    genre_ids: item.genre_ids || [],
  }));

  const standardizedPopular = (popularData.results || []).map((item: any) => ({
    tmdb_id: item.id,
    title: item.name,
    release_year: item.first_air_date?.split("-")[0] || null,
    genre_ids: item.genre_ids || [],
    photo_url: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
  }));

  const standardizedAiring = (airingData.results || []).map((item: any) => ({
    tmdb_id: item.id,
    title: item.name,
    release_year: item.first_air_date?.split("-")[0] || null,
    genre_ids: item.genre_ids || [],
    photo_url: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
  }));

  const rankedLists: RankedList[] = [
    { name: "recommended", items: recommendedFilms as FilmType[] },
    { name: "collaborative", items: standardizedCollaborative as FilmType[] },
    { name: "popular", items: standardizedPopular as FilmType[] },
    { name: "airing", items: standardizedAiring as FilmType[] },
  ];

  const fused = applyRRF(rankedLists);
  const filtered = fused.filter((item: any) => !(item.tags || []).includes(99));
  return applyGenreDiversity(filtered, MAX_POOL_SIZE);
};

export const getInitialFeed = async ({
  supabaseClient,
  userId,
  page = 1,
  pageSize = 20,
}: GetFeedRequestType): Promise<GetFeedResponseType> => {
  const cacheKey = getFeedCacheKey(userId);

  let rankedFilms: FilmType[];
  let cached: string | null = null;

  try {
    cached = await redis.get(cacheKey);
  } catch (err) {
    console.error("[getInitialFeed] Redis read failed, computing fresh:", err);
  }

  if (cached) {
    rankedFilms = JSON.parse(cached) as FilmType[];
    console.log(`[getInitialFeed] Cache hit for ${userId}, ${rankedFilms.length} films`);
  } else {
    try {
      rankedFilms = await buildCandidatePool({ supabaseClient, userId });
    } catch (err) {
      console.error(`[getInitialFeed] Exception:`, err);
      throw new Error(`Failed to generate feed: ${err instanceof Error ? err.message : String(err)}`);
    }

    redis.set(cacheKey, JSON.stringify(rankedFilms), "EX", getFeedTTL())
      .catch(err => console.error("[getInitialFeed] Redis write failed:", err));

    console.log(`[getInitialFeed] Cache miss for ${userId}, computed ${rankedFilms.length} films`);
  }

  const start = (page - 1) * pageSize;
  const pageFilms = rankedFilms.slice(start, start + pageSize);
  const films = await reRankWithXGBoost(supabaseClient, userId, pageFilms);
  const hasMore = start + pageSize < rankedFilms.length;

  return { films, page, pageSize, hasMore };
};
