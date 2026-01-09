import type { SupabaseClient } from "@supabase/supabase-js";

// Only Select Films Here
type SelectFilmRequestType = {
  supabaseClient: SupabaseClient
};

export const bookmarkFilm = async () => {

}

// Get Recommended Films based on their Profile Embeddings
export const getRecommendedFilms = async ({supabaseClient}: SelectFilmRequestType) => {
  const response = supabaseClient.rpc("", {

  })
  return response
}

// Get All Films
export const getFilms = async ({ supabaseClient }: SelectFilmRequestType) => {
  // Let them search by 
  const { data: filmData, error: filmError } = await supabaseClient
    .from("Films")
    .select("title, cast, id, director, genre, poster_url, release_year")
    .limit(100);

  if (filmError) {
    throw new Error("Failed to Get Films");
  }

  return filmData;
};