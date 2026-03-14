import { createServerSideSupabaseClient } from "../supabase/configureSupabase.js";

const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;

const DRAMA_COUNTRIES = {
  kdrama: "KR",
  jdrama: "JP",
  cdrama: "CN",
} as const;

const PAGES_TO_FETCH = [1, 2] as const;
const EXCLUDED_GENRES = "10764,10763,10767,10762";

type TmdbTvResult = {
  id: number;
  name?: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string;
  origin_country?: string[];
  popularity?: number;
};

type TmdbDiscoverResponse = {
  page: number;
  results: TmdbTvResult[];
  total_pages: number;
  total_results: number;
};

const buildDiscoverParams = (countryCode: string, page: number) => {
  return new URLSearchParams({
    with_origin_country: countryCode,
    sort_by: "first_air_date.desc",
    include_adult: "false",
    include_null_first_air_dates: "false",
    language: "en-US",
    page: String(page),
    without_genres: EXCLUDED_GENRES,
  });
};

const fetchNewestDramasPage = async (
  countryCode: string,
  page: number,
): Promise<TmdbDiscoverResponse> => {
  const params = buildDiscoverParams(countryCode, page);
  const response = await fetch(`${TMDB_API_BASE}/3/discover/tv?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${TMDB_API_KEY}`,
    },
  });

  if (!response.ok) {
    console.error(
      `[fetchNewestDramasPage] TMDB API error - country=${countryCode}, page=${page}, status=${response.status}`,
      response.statusText,
    );
    throw new Error(`Failed to fetch newest dramas: HTTP ${response.status}`);
  }

  return (await response.json()) as TmdbDiscoverResponse;
};

const fetchNewestDramasByCountry = async (countryCode: string): Promise<TmdbTvResult[]> => {
  const pages = await Promise.all(
    PAGES_TO_FETCH.map((page) => fetchNewestDramasPage(countryCode, page)),
  );

  const deduped = new Map<number, TmdbTvResult>();
  for (const pageResult of pages) {
    for (const drama of pageResult.results ?? []) {
      if (!deduped.has(drama.id)) {
        deduped.set(drama.id, drama);
      }
    }
  }

  return [...deduped.values()];
};

export async function getNewestFilms() {
  const [kdrama, jdrama, cdrama] = await Promise.all([
    fetchNewestDramasByCountry(DRAMA_COUNTRIES.kdrama),
    fetchNewestDramasByCountry(DRAMA_COUNTRIES.jdrama),
    fetchNewestDramasByCountry(DRAMA_COUNTRIES.cdrama),
  ]);

  return { kdrama, jdrama, cdrama };
}

export async function scrapeFilmData() {
  const supabaseClient = createServerSideSupabaseClient();
  try {
    const newestFilms = await getNewestFilms();
    const { error} = await supabaseClient.from("Films").insert({
        
    })
    if (error) {
        throw new Error(`Failed to insert newest films: ${error.message}`);
    }

} catch (err) {
    console.error("[scrapeFilmData] Failed to scrape newest drama data", err);
    throw err;
  }
}
