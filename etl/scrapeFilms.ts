import { createServerSideSupabaseClient } from "../service/supabase/configureSupabase.js";

const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;

const COUNTRIES = ["KR", "JP", "CN"] as const;
const PAGES_TO_FETCH = 10;
const MIN_POPULARITY = 10;
const EXCLUDED_GENRES = "10764,10763,10767,10762";

type MediaType = "tv" | "movie";
type TmdbResultType = {
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
  poster_path?: string;
  genre_ids?: number[];
};

type TmdbDiscoverResponseType = {
  page: number;
  results: TmdbResultType[];
  total_pages: number;
  total_results: number;
};

// Build Requests
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
): Promise<TmdbResultType[]> => {
  const params = buildDiscoverParams(country, page, mediaType);
  const res = await fetch(
    `${TMDB_API_BASE}/3/discover/${mediaType}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${TMDB_API_KEY}` } },
  );

  if (!res.ok) {
    console.error(
      `[fetchDiscoverPage] TMDB error - ${mediaType} country=${country} page=${page} status=${res.status}`,
    );
    throw new Error(`TMDB API error: ${res.statusText}`);
  }

  const data = (await res.json()) as TmdbDiscoverResponseType;
  return (data.results ?? [])
    .filter((r) => (r.popularity ?? 0) >= MIN_POPULARITY)
    .map((r) => ({ ...r, media_type: mediaType }));
};

const fetchAllFilms = async (country: string): Promise<TmdbResultType[]> => {
  const pages = Array.from({ length: PAGES_TO_FETCH }, (_, i) => i + 1);

  const [tvResults, movieResults] = await Promise.all([
    Promise.all(pages.map((p) => fetchDiscoverPage(country, p, "tv"))),
    Promise.all(pages.map((p) => fetchDiscoverPage(country, p, "movie"))),
  ]);
  return [...tvResults.flat(), ...movieResults.flat()];
};

const upsertToStaging = async (films: TmdbResultType[]) => {
  const supabase = createServerSideSupabaseClient();
  const rows = films.map((f) => ({
    tmdb_id: f.id,
    name: f.name ?? null,
    title: f.title ?? null,
    original_name: f.original_name ?? null,
    original_title: f.original_title ?? null,
    overview: f.overview ?? null,
    first_air_date: f.first_air_date ?? null,
    release_date: f.release_date ?? null,
    origin_country: f.origin_country ?? [],
    popularity: f.popularity ?? 0,
    media_type: f.media_type,
    poster_path: f.poster_path ?? null,
    genre_ids: f.genre_ids ?? [],
  }));

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("Films_Staging")
      .upsert(batch, { onConflict: "tmdb_id" });

    if (error) {
      throw new Error(`Failed to upsert staging batch: ${error.message}`);
    }
  }
  console.log(`[scrapeFilms] Upserted ${rows.length} films to staging`);
};

const dedupeAndInsert = async () => {
  const supabase = createServerSideSupabaseClient();

  // Fetch all tmdb_ids from staging
  const { data: stagingRows, error: stagingError } = await supabase
    .from("Films_Staging")
    .select("tmdb_id");

  if (stagingError) {
    throw new Error(`Failed to read staging: ${stagingError.message}`);
  }
  
  if (!stagingRows || stagingRows.length === 0) {
    console.log("[scrapeFilms] Staging is empty, nothing to dedupe");
    return;
  }

  const stagingIds = stagingRows.map((r) => r.tmdb_id);

  // Fetch existing tmdb_ids from Guanghai
  const { data: existingRows, error: existingError } = await supabase
    .from("Guanghai")
    .select("tmdb_id")
    .in("tmdb_id", stagingIds);

  if (existingError) {
    throw new Error(`Failed to read Guanghai: ${existingError.message}`);
  }

  const existingSet = new Set((existingRows ?? []).map((r) => r.tmdb_id));
  const newIds = stagingIds.filter((id) => !existingSet.has(id));

  if (newIds.length === 0) {
    console.log("[scrapeFilms] No new films to insert into Guanghai");
    return;
  }

  // Fetch full rows from staging for new films only
  const { data: newFilms, error: fetchError } = await supabase
    .from("Films_Staging")
    .select("*")
    .in("tmdb_id", newIds);

  if (fetchError) {
    throw new Error(`Failed to fetch new films from staging: ${fetchError.message}`);
  }

  // Transform staging rows to Guanghai schema
  const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
  const guanghaiRows = newFilms!.map((f: any) => ({
    tmdb_id: f.tmdb_id,
    title: f.name || f.title || f.original_name || f.original_title || "Unknown",
    release_year: (f.first_air_date || f.release_date || "").split("-")[0] || null,
    genre_ids: f.genre_ids ?? [],
    media_type: f.media_type,
    photo_url: f.poster_path ? `${TMDB_IMAGE_BASE}${f.poster_path}` : null,
    film_embedding: null,
  }));

  // Insert into Guanghai in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < guanghaiRows.length; i += BATCH_SIZE) {
    const batch = guanghaiRows.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from("Guanghai")
      .insert(batch);

    if (insertError) {
      throw new Error(`Failed to insert into Guanghai: ${insertError.message}`);
    }
  }
  console.log(`[scrapeFilms] Inserted ${guanghaiRows.length} new films into Guanghai`);
};

const clearStaging = async () => {
  const supabase = createServerSideSupabaseClient();
  const { error } = await supabase
    .from("Films_Staging")
    .delete()
    .neq("tmdb_id", 0); // delete all rows

  if (error) {
    throw new Error(`Failed to clear staging: ${error.message}`);
  }
  console.log("[scrapeFilms] Staging table cleared");
};

const scrapeFilms = async () => {
  console.log("[scrapeFilms] Starting scrape...");
  for (const country of COUNTRIES) {
    console.log(`[scrapeFilms] Fetching films for country: ${country}`);
    const films = await fetchAllFilms(country);
    console.log(`[scrapeFilms] Fetched ${films.length} films for ${country}`);
    await upsertToStaging(films);
  }

  await dedupeAndInsert();
  await clearStaging();
  console.log("[scrapeFilms] Scrape pipeline complete");
};

export default scrapeFilms;
