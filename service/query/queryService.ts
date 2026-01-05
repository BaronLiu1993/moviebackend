import { error } from "node:console";
import { createSupabaseClient } from "../../service/supabase/configureSupabase.js";
import { type Response } from "express";

// Webscrape new professors
type SelectFilmRequestType = {
  accessToken: string;
};

export const selectFilms = async ({ accessToken }: SelectFilmRequestType) => {
  const supabase = createSupabaseClient({ accessToken });
  const { data: filmData, error: filmError } = await supabase.from("").select();
  if (filmError) {
    throw new Error("Failed to Get Films");
  }
  return filmData;
};
