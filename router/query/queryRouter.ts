import { Router } from "express";
import { createSupbaseClient } from "../../service/supabase/configureSupabase.js";

// Webscrape new professors
type SelectFilmRequestType = {
  accessToken: string;
};

export const selectFilms = ({ accessToken }: SelectFilmRequestType) => {
  const supabase = createSupbaseClient({ accessToken });
  const { data, error } = supabase
    .from("")
    .select()
};
