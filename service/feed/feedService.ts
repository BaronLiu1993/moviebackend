import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const MMR_LAMBDA = 0.8;

type FilmType = {
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
    // Get Top K closest friends and then get their top rated-films as collaborative filters
    const { data: topKData, error: topKError } = await supabaseClient.rpc(
      "get_collaborative_filters",
      {
        user_id: userId
      },
    );

    if (topKError) {
      throw new Error(`Failed to fetch collaborative filters: ${topKError.message}`);
    }


    const seen = new Set<number>();
    const films: { film_id: number; rating: number; film_name: string; genre_ids: number[] }[] = [];
    for (const friendId of topKData) {
      const { data: friendFilms, error: friendFilmsError } = await supabaseClient
        .from("Ratings")
        .select("film_id, rating, film_name, genre_ids")
        .eq("user_id", friendId)
        .gte("rating", 4)
        .limit(20);

      if (friendFilmsError || !friendFilms) continue;

      for (const film of friendFilms) {
        if (!seen.has(film.film_id)) {
          seen.add(film.film_id);
          films.push(film);
        }
      }
    }
    console.log(
      `[getCollaborativeFilters] Successfully fetched ${films.length} collaborative filters`,
    );
    return films;
  } catch (err) {
    console.error(`[getCollaborativeFilters] Exception:`, err);
    throw err;
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

//MMR = λ * relevance(item) - (1-λ) * max_similarity(item, selected_items)
const applyMMR = (
  candidates: FilmType[],
  finalCount: number,
  lambda: number = MMR_LAMBDA,
): FilmType[] => {
  if (candidates.length <= finalCount) return candidates;

  const selected: FilmType[] = [];
  const remaining = [...candidates];

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
        ...selected.map((s) =>
          genreSimilarity(candidate.genre_ids, s.genre_ids),
        ),
      );

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
  page = 1,
  pageSize = 20,
}: GetFeedRequestType): Promise<GetFeedResponseType> => {
  try {
    const RPC_BATCH_SIZE = 300;
    const offsetCount = (page - 1) * RPC_BATCH_SIZE;
    const isFirstPage = page === 1;

    const [recommendedFilms, popularData, airingData] = await Promise.all([
      getRecommendedFilms({
        supabaseClient,
        userId,
        limitCount: RPC_BATCH_SIZE,
        offsetCount,
      }),
      ...(isFirstPage ? [getPopularDramas(), getAiringDramas()] : []),
    ]);

    console.log(
      `[getInitialFeed] RPC returned ${recommendedFilms.length} films`,
    );

    const data = recommendedFilms;

    const standardizedPopular = isFirstPage
      ? (popularData.results || []).map((item: any) => ({
          tmdb_id: item.id,
          title: item.name,
          release_year: item.first_air_date?.split("-")[0] || null,
          genre_ids: item.genre_ids || [],
          photo_url: item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : null, // Make it default to placeholder
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

    const seen = new Set<number>();
    const combined = [
      ...data,
      ...standardizedPopular,
      ...standardizedAiring,
    ].filter((item: any) => {
      if ((item.tags || []).includes(99)) return false;
      if (seen.has(item.tmdb_id)) return false;
      seen.add(item.tmdb_id);
      return true;
    });

    const films = applyMMR(combined as FilmType[], pageSize, MMR_LAMBDA);
    const hasMore = data.length >= RPC_BATCH_SIZE;
    console.log(
      `[getInitialFeed] page=${page}, returned=${films.length}, hasMore=${hasMore} (candidates: ${combined.length}, personalized: ${data.length}, popular: ${standardizedPopular.length}, airing: ${standardizedAiring.length})`,
    );

    return { films, page, pageSize, hasMore };
  } catch (err) {
    console.error(`[getInitialFeed] Exception:`, err);
    throw new Error(`Failed to generate feed: ${err instanceof Error ? err.message : String(err)}`);
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
