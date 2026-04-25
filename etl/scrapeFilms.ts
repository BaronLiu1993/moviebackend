import { createServerSideSupabaseClient } from "../service/supabase/configureSupabase.js";
import log from "../lib/logger.js";
import {
  SCRAPE_COUNTRIES, SCRAPE_PAGES_TO_FETCH, SCRAPE_MIN_POPULARITY,
  SCRAPE_EXCLUDED_GENRES, TMDB_IMAGE_BASE, SCRAPE_BATCH_SIZE,
} from "../config/constants.js";

const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const ADULT_KEYWORDS = new Set([
  "sex", "erotic", "porn", "hentai", "nude", "naked",
  "xxx", "adult only", "18+", "hostel", "stripclub",
  "strip club", "brothel", "escort", "prostitut",
  "fetish", "voyeur", "softcore", "hardcore",
  "obscene", "orgasm", "orgy", "threesome",
  "playboy", "onlyfans", "Adultery"
]);

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

type FetchMode = "recent" | "airing";

// Build Requests
const buildDiscoverParams = (
  country: string,
  page: number,
  mediaType: MediaType,
  mode: FetchMode = "recent",
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
    params.set("without_genres", SCRAPE_EXCLUDED_GENRES);
  }
  if (mediaType === "movie") {
    params.set("sort_by", "release_date.desc");
  }

  // Currently-airing TV filter
  if (mode === "airing" && mediaType === "tv") {
    const today = new Date().toISOString().split("T")[0] || "";
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startDate = threeMonthsAgo.toISOString().split("T")[0] || "";
    params.set("air_date.gte", startDate);
    params.set("air_date.lte", today);
    params.set("with_status", "0"); // Returning Series
  }

  return params;
};

const fetchDiscoverPage = async (
  country: string,
  page: number,
  mediaType: MediaType,
  mode: FetchMode = "recent",
): Promise<TmdbResultType[]> => {
  const params = buildDiscoverParams(country, page, mediaType, mode);
  const res = await fetch(
    `${TMDB_API_BASE}/3/discover/${mediaType}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${TMDB_API_KEY}` } },
  );

  if (!res.ok) {
    log.error({ mediaType, country, page, mode, status: res.status }, "TMDB API error");
    throw new Error(`TMDB API error: ${res.statusText}`);
  }

  const data = (await res.json()) as TmdbDiscoverResponseType;
  return (data.results ?? [])
    .filter((r) => (r.popularity ?? 0) >= SCRAPE_MIN_POPULARITY)
    .map((r) => ({ ...r, media_type: mediaType }));
};


const isAdultTitle = (film: TmdbResultType): boolean => {
  const title = (film.name || film.title || film.original_name || film.original_title || "").toLowerCase();
  for (const kw of ADULT_KEYWORDS) {
    if (title.includes(kw)) return true;
  }
  return false;
};

const hasRequiredData = (film: TmdbResultType): boolean => {
  const hasId = !!film.id;
  const hasTitle = !!(film.name || film.title || film.original_name || film.original_title);
  const hasOverview = !!(film.overview && film.overview.trim().length > 0);
  const hasDate = !!(film.first_air_date || film.release_date);
  const hasGenres = !!(film.genre_ids && film.genre_ids.length > 0);
  const hasPoster = !!(film.poster_path && film.poster_path.trim().length > 0);
  const hasPopularity = typeof film.popularity === "number" && film.popularity > 0;
  const hasCountry = !!(film.origin_country && film.origin_country.length > 0);
  return hasId && hasTitle && hasOverview && hasDate && hasGenres && hasPoster && hasPopularity && hasCountry;
};

const fetchAllFilms = async (country: string): Promise<TmdbResultType[]> => {
  const pages = Array.from({ length: SCRAPE_PAGES_TO_FETCH }, (_, i) => i + 1);

  const [tvResults, movieResults, airingResults] = await Promise.all([
    Promise.all(pages.map((p) => fetchDiscoverPage(country, p, "tv", "recent"))),
    Promise.all(pages.map((p) => fetchDiscoverPage(country, p, "movie", "recent"))),
    Promise.all(pages.map((p) => fetchDiscoverPage(country, p, "tv", "airing"))),
  ]);

  const merged = [...tvResults.flat(), ...movieResults.flat(), ...airingResults.flat()];

  // Dedupe by tmdb id (airing and recent lists overlap)
  const seen = new Set<number>();
  const raw: TmdbResultType[] = [];
  for (const film of merged) {
    if (seen.has(film.id)) continue;
    seen.add(film.id);
    raw.push(film);
  }

  const filtered = raw.filter((film) => {
    if (!hasRequiredData(film)) return false;
    if (isAdultTitle(film)) return false;
    return true;
  });

  const removed = raw.length - filtered.length;
  if (removed > 0) {
    log.info({ country, removed }, "Filtered out films (incomplete data or adult content)");
  }

  log.info({ country, airingCount: airingResults.flat().length, total: filtered.length }, "Fetched films");

  return filtered;
};


const transformToGuanghai = (films: TmdbResultType[]) =>
  films.map((f) => ({
    tmdb_id: f.id,
    title: f.name || f.title || f.original_name || f.original_title || "Unknown",
    release_year: (f.first_air_date || f.release_date || "").split("-")[0] || null,
    genre_ids: f.genre_ids ?? [],
    media_type: f.media_type === "tv" ? "show" : "movie",
    photo_url: f.poster_path ? `${TMDB_IMAGE_BASE}${f.poster_path}` : null,
    overview: f.overview ?? null,
    film_embedding: null,
  }));

const insertNewFilms = async (films: TmdbResultType[]) => {
  if (films.length === 0) return;
  const supabase = createServerSideSupabaseClient();
  const tmdbIds = films.map((f) => f.id);
  const existingSet = new Set<number>();
  for (let i = 0; i < tmdbIds.length; i += SCRAPE_BATCH_SIZE) {
    const batchIds = tmdbIds.slice(i, i + SCRAPE_BATCH_SIZE);
    const { data, error } = await supabase
      .from("Guanghai")
      .select("tmdb_id")
      .in("tmdb_id", batchIds);

    if (error) {
      log.error({ err: error.message }, "Error checking existing IDs");
      continue;
    }
    for (const row of data ?? []) {
      existingSet.add(row.tmdb_id);
    }
  }
  
  const newFilms = films.filter((f) => !existingSet.has(f.id));

  if (newFilms.length === 0) {
    log.info("No new films to insert");
    return;
  }

  const rows = transformToGuanghai(newFilms);
  console.log(rows)

  let inserted = 0;
  for (let i = 0; i < rows.length; i += SCRAPE_BATCH_SIZE) {
    const batch = rows.slice(i, i + SCRAPE_BATCH_SIZE);
    const { error } = await supabase
      .from("Guanghai")
      .insert(batch);

    if (error) {
      log.error({ err: error.message }, "Error inserting batch");
      continue;
    }
    inserted += batch.length;
  }
  
  log.info({ inserted, alreadyExisted: existingSet.size }, "Inserted new films into Guanghai");
};

const scrapeFilms = async () => {
  log.info("Starting scrape pipeline");
  for (const country of SCRAPE_COUNTRIES) {
    log.info({ country }, "Fetching films for country");
    const films = await fetchAllFilms(country);
    log.info({ country, count: films.length }, "Fetched films");
    await insertNewFilms(films);
  }
  log.info("Scrape pipeline complete");
};

export default scrapeFilms;
