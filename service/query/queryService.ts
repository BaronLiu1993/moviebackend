import type { SupabaseClient } from "@supabase/supabase-js";

const TMDB_API_BASE = process.env.TMDB_API_BASE;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Only Select Films Here
type SelectFilmRequestType = {
  genres: string;
  countries: string;
};


export const bookmarkFilm = async () => {};

// Get Recommended Films based on their Profile Embeddings
export const getRecommendedFilms = async ({

}: SelectFilmRequestType) => {

};

// Get All Films
export const getRelatedFilms = async ({
  genres,
  countries,
}: SelectFilmRequestType) => {
  // Let them search by
  const fetchSearches = await fetch(
    `${TMDB_API_BASE}/3/discover/movie?with_genres=${genres}&with_origin_country=${countries}&page=1`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
      },
    }
  );

  console.log(fetchSearches)
  const searches = await fetchSearches.json();
  return searches;
};
