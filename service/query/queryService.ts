import { createSupbaseClient } from "../../service/supabase/configureSupabase.js";
import { type Response } from "express";

// Webscrape new professors
type SelectFilmRequestType = {
  accessToken: string;
  res: Response;
};

export const selectFilms = async ({
  accessToken,
  res,
}: SelectFilmRequestType) => {
  const supabase = createSupbaseClient({ accessToken });
  const { data: filmData, error: filmError } = await supabase.from("").select();
  if (filmError) {
    return res.status(400).json({ message: "Failed To Fetch Films" });
  }
  return filmData;
};
