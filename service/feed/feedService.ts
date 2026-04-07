import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
import { insertInteractionEvents } from "../clickhouse/clickhouseService.js";

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
};

type UnlikeFilmType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  tmdbId: number;
};

export const likeFilm = async ({ supabaseClient, userId, tmdbId, film_name, genre_ids }: LikeFilmType) => {
  try {
    const { error: insertError } = await supabaseClient
      .from("Film_Likes")
      .insert({ tmdb_id: tmdbId, user_id: userId });

    if (insertError) {
      if (insertError.code === "23505") throw new Error("Already liked this film");
      console.error(`[likeFilm] Error liking film ${tmdbId} for user ${userId}:`, insertError);
      throw new Error(`Failed to like film: ${insertError.message}`);
    }

    // Increment like_count on Guanghai
    await supabaseClient.rpc("increment_film_like_count", { p_tmdb_id: tmdbId });

    await insertInteractionEvents({ userId, tmdbId, interactionType: "like", film_name, genre_ids, rating: 0 });
  } catch (err) {
    console.error(`[likeFilm] Exception:`, err);
    throw err;
  }
};

export const unlikeFilm = async ({ supabaseClient, userId, tmdbId }: UnlikeFilmType) => {
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

    // Decrement like_count on Guanghai
    await supabaseClient.rpc("decrement_film_like_count", { p_tmdb_id: tmdbId });

    await insertInteractionEvents({ userId, tmdbId, interactionType: "like", rating: 0 });
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


    const films: { film_id: number; rating: number; film_name: string; genre_ids: number[] }[] = [];
    for (const friendId of topKData) {
      const { data: friendFilms, error: friendFilmsError } = await supabaseClient
        .from("Ratings")
        .select("film_id, rating, film_name, genre_ids")
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

type CollaborativeFilm = { film_id: number; rating: number; film_name: string; genre_ids: number[] };

export const deduplicateCollaborative = (films: CollaborativeFilm[]): CollaborativeFilm[] => {
  const map = new Map<number, { totalRating: number; count: number; film_name: string; genre_ids: number[] }>();

  for (const film of films) {
    const existing = map.get(film.film_id);
    if (existing) {
      existing.totalRating += film.rating;
      existing.count += 1;
    } else {
      map.set(film.film_id, {
        totalRating: film.rating,
        count: 1,
        film_name: film.film_name,
        genre_ids: film.genre_ids,
      });
    }
  }

  return Array.from(map.entries())
    .map(([film_id, val]) => ({
      film_id,
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


//Generate feed for users precompute -> cache -> fetch from cache (Redis) -> fallback to real-time computation if cache miss (TTL and randomise it to prevent cache stampedes)

// Returns personalized film recommendations based on user embeddings, with pagination support
export const getInitialFeed = async ({
  supabaseClient,
  userId,
  page = 1,
  pageSize = 20,
}: GetFeedRequestType): Promise<GetFeedResponseType> => {
  try {
    const RPC_BATCH_SIZE = 300;
    const offsetCount = (page - 1) * RPC_BATCH_SIZE;
    const isFirstPage = page === 1;

    const [recommendedFilms, collaborativeFilms, popularData, airingData] = await Promise.all([
      getRecommendedFilms({
        supabaseClient,
        userId,
        limitCount: RPC_BATCH_SIZE,
        offsetCount,
      }),
      getCollaborativeFilters({ supabaseClient, userId }),
      ...(isFirstPage ? [getPopularDramas(), getAiringDramas()] : []),
    ]);

    console.log(
      `[getInitialFeed] RPC returned ${recommendedFilms.length} films, collaborative returned ${collaborativeFilms.length} films`,
    );

    const data = recommendedFilms;

    // Deduplicate collaborative films before ranking
    const dedupedCollaborative = deduplicateCollaborative(collaborativeFilms);
    const standardizedCollaborative = dedupedCollaborative.map((item) => ({
      tmdb_id: item.film_id,
      title: item.film_name,
      release_year: "",
      genre_ids: item.genre_ids || [],
    }));

    const standardizedPopular = isFirstPage
      ? (popularData.results || []).map((item: any) => ({
          tmdb_id: item.id,
          title: item.name,
          release_year: item.first_air_date?.split("-")[0] || null,
          genre_ids: item.genre_ids || [],
          photo_url: item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : null,
        }))
      : [];

    const standardizedAiring = isFirstPage
      ? (airingData.results || []).map((item: any) => ({
          tmdb_id: item.id,
          title: item.name,
          release_year: item.first_air_date?.split("-")[0] || null,
          genre_ids: item.genre_ids || [],
          photo_url: item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : null,
        }))
      : [];

    // Build ranked lists for RRF (each pre-sorted by natural ordering)
    const rankedLists: RankedList[] = [
      { name: "recommended", items: data as FilmType[] },
      { name: "collaborative", items: standardizedCollaborative as FilmType[] },
      ...(isFirstPage
        ? [
            { name: "popular" as const, items: standardizedPopular as FilmType[] },
            { name: "airing" as const, items: standardizedAiring as FilmType[] },
          ]
        : []),
    ];

    const fused = applyRRF(rankedLists);
    const filtered = fused.filter((item: any) => !(item.tags || []).includes(99));
    const films = applyGenreDiversity(filtered, pageSize);

    const hasMore = data.length >= RPC_BATCH_SIZE;
    console.log(
      `[getInitialFeed] page=${page}, returned=${films.length}, hasMore=${hasMore} (fused: ${fused.length}, personalized: ${data.length}, collaborative: ${standardizedCollaborative.length}, popular: ${standardizedPopular.length}, airing: ${standardizedAiring.length})`,
    );

    return { films, page, pageSize, hasMore };
  } catch (err) {
    console.error(`[getInitialFeed] Exception:`, err);
    throw new Error(`Failed to generate feed: ${err instanceof Error ? err.message : String(err)}`);
  }
};
