import type { SupabaseClient } from "@supabase/supabase-js";
import { generateFilmEmbeddings } from "../../etl/generateEmbeddings.js";
import { applyRRF } from "../feed/feedService.js";
import type { FilmType } from "../feed/feedService.js";
import { SEARCH_RRF_K, SEARCH_RRF_WEIGHTS, SEARCH_RPC_LIMIT } from "../../config/constants.js";

type SearchParams = {
  supabaseClient: SupabaseClient;
  query: string;
  page: number;
  pageSize: number;
  mediaType?: string | undefined;
  country?: string | undefined;
  releaseYear?: number | undefined;
  genreIds?: number[] | undefined;
};

type SearchResponse = {
  films: FilmType[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

const standardizeResults = (data: any[]): FilmType[] =>
  data.map((r) => ({
    tmdb_id: r.tmdb_id,
    title: r.title,
    release_year: r.release_year ?? "",
    genre_ids: r.genre_ids ?? [],
    photo_url: r.photo_url,
    media_type: r.media_type,
  }));

export const searchFilms = async ({
  supabaseClient,
  query,
  page,
  pageSize,
  mediaType,
  country,
  releaseYear,
  genreIds,
}: SearchParams): Promise<SearchResponse> => {
  const sharedFilters = {
    filter_media_type: mediaType ?? null,
    filter_country: country ?? null,
    filter_release_year: releaseYear?.toString() ?? null,
    filter_genre_ids: genreIds ?? null,
    result_limit: SEARCH_RPC_LIMIT,
  };

  // Fire keyword search immediately (no embedding dependency)
  const keywordPromise = supabaseClient.rpc("search_films_keyword", {
    search_query: query,
    ...sharedFilters,
  });

  // Generate embedding, then fire semantic search
  const [queryEmbedding] = await generateFilmEmbeddings([query]);

  const semanticPromise = supabaseClient.rpc("search_films_semantic", {
    query_embedding: queryEmbedding,
    ...sharedFilters,
  });

  // Await both
  const [keywordResult, semanticResult] = await Promise.all([
    keywordPromise,
    semanticPromise,
  ]);

  if (keywordResult.error) {
    throw new Error(`Keyword search failed: ${keywordResult.error.message}`);
  }
  if (semanticResult.error) {
    throw new Error(`Semantic search failed: ${semanticResult.error.message}`);
  }

  const keywordFilms = standardizeResults(keywordResult.data ?? []);
  const semanticFilms = standardizeResults(semanticResult.data ?? []);

  // Fuse via RRF
  const fused = applyRRF(
    [
      { name: "keyword", items: keywordFilms },
      { name: "semantic", items: semanticFilms },
    ],
    SEARCH_RRF_K,
    SEARCH_RRF_WEIGHTS,
  );

  // Paginate
  const start = (page - 1) * pageSize;
  const paginatedFilms = fused.slice(start, start + pageSize);

  const hasMore = start + pageSize < fused.length;

  return {
    films: paginatedFilms,
    page,
    pageSize,
    hasMore,
  };
};
