import { createServerSideSupabaseClient } from "../service/supabase/configureSupabase.js";

const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;

const COUNTRIES = ["KR", "JP", "CN"] as const;
const PAGES_TO_FETCH = 10;
const MIN_POPULARITY = 10;
const EXCLUDED_GENRES = "10764,10763,10767,10762";

type MediaType = "tv" | "movie";

type TmdbResultSchema = {
  id: number;
  name?: string;
  title?: string;
  original_name?: string;
  original_title?: string;
  overview?: string;
  first_air_date?: string;
  release_date?: string;
  origin_country?: string[];
  popularity?: number;
  media_type: MediaType;
};

type TmdbDiscoverResponseSchema = {
  page: number;
  results: TmdbResultSchema[];
  total_pages: number;
  total_results: number;
};

const headers = { Authorization: `Bearer ${TMDB_API_KEY}` };

const buildDiscoverParams = (
  country: string,
  page: number,
  mediaType: MediaType,
) => {
  const params = new URLSearchParams({
    with_origin_country: country,
    sort_by: "first_air_date.desc",
    include_adult: "false",
    include_null_first_air_dates: "false",
    language: "en-US",
    page: String(page),
  });

  if (mediaType === "tv") {
    params.set("without_genres", EXCLUDED_GENRES);
  }
  if (mediaType === "movie") {
    params.set("sort_by", "release_date.desc");
  }

  return params;
};

const fetchDiscoverPage = async (
  country: string,
  page: number,
  mediaType: MediaType,
): Promise<TmdbResultSchema[]> => {
  const params = buildDiscoverParams(country, page, mediaType);
  const res = await fetch(
    `${TMDB_API_BASE}/3/discover/${mediaType}?${params.toString()}`,
    { headers },
  );

  if (!res.ok) {
    console.error(
      `[fetchDiscoverPage] TMDB error - ${mediaType} country=${country} page=${page} status=${res.status}`,
    );
    return [];
  }

  const data = (await res.json()) as TmdbDiscoverResponseSchema;
  return (data.results ?? [])
    .filter((r) => (r.popularity ?? 0) >= MIN_POPULARITY)
    .map((r) => ({ ...r, media_type: mediaType }));
};

const fetchAllForCountry = async (country: string): Promise<TmdbResultSchema[]> => {
  const pages = Array.from({ length: PAGES_TO_FETCH }, (_, i) => i + 1);

  const [tvResults, movieResults] = await Promise.all([
    Promise.all(pages.map((p) => fetchDiscoverPage(country, p, "tv"))),
    Promise.all(pages.map((p) => fetchDiscoverPage(country, p, "movie"))),
  ]);

  const deduped = new Map<string, TmdbResultSchema>();
  for (const result of [...tvResults.flat(), ...movieResults.flat()]) {
    const key = `${result.media_type}-${result.id}`;
    if (!deduped.has(key)) {
      deduped.set(key, result);
    }
  }

  return [...deduped.values()];
};

const bulkInsertFilms = async (films: TmdbResultSchema[]) => {
  try {
    const supabase = createServerSideSupabaseClient();
    const { error: filmInsertionError } = await supabase
      .from("Films")
      .insert(films);
    if (filmInsertionError) {
      throw Error("Failed to insert films: " + filmInsertionError?.message);
    }
    console.log(`Inserted ${films.length} films successfully.`);
  } catch {
    console.error("Error inserting films into database");
    throw Error("Failed to insert films");
  }
};

// Main function to scrape films and insert into database
const scrapeFilms = async () => {
  try {
    for (const country of COUNTRIES) {
      console.log(`Fetching films for country: ${country}`);
      const films = await fetchAllForCountry(country);
      console.log(`Fetched ${films.length} films for country: ${country}`);
      await bulkInsertFilms(films);
    }
    console.log("Finished scraping films for all countries.");
  } catch {
    console.error("Error fetching films from TMDB");
    throw Error("Failed to fetch films from TMDB");
  }
};

export default scrapeFilms;