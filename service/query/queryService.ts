import type { SupabaseClient } from "@supabase/supabase-js";

type SelectFilmRequestType = {
  supabaseClient: SupabaseClient
};

type DeleteFilmRequestType = {
  supabaseClient: SupabaseClient
};

type RateFilmRequestType = {
  supabaseClient: SupabaseClient
  userId: string;
  rating: number;
  note: string;
}

export const getRecommendedFilms = async ({supabaseClient}: SelectFilmRequestType) => {
  const response = supabaseClient.rpc("", )
  return response
}

// Get All Films
export const getFilms = async ({ supabaseClient }: SelectFilmRequestType) => {
  const { data: filmData, error: filmError } = await supabaseClient.from("").select();
  if (filmError) {
    throw new Error("Failed to Get Films");
  }
  return filmData;
};


export const deleteFilms = async ({supabaseClient}: DeleteFilmRequestType) => {
} 
