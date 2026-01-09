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
  
};