import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

const TMDB_API_BASE = process.env.TMDB_API_BASE;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Request Types
type SelectRelatedFilmRequestType = {
  genres: string;
  countries: string;
};

interface SelectRecommendedFilmRequestType {
  supabaseClient: SupabaseClient;
  userId: UUID;
}

interface SelectFriendsFilmRequestType
  extends SelectRecommendedFilmRequestType {}

type BookmarkRequestType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  filmId: number;
};

// Bookmark a Film
export const bookmarkFilm = async ({supabaseClient, userId, filmId}: BookmarkRequestType) => {
  const { data, error } = await supabaseClient.from("bookmarks").insert({
    user_id: userId,
    film_id: filmId
  })

  if (error) {
    throw new Error("Failed to Bookmark Film")
  }
};

// Get Recommended Films based on their Profile Embeddings
export const getRecommendedFilms = async ({
  supabaseClient,
  userId,
}: SelectRecommendedFilmRequestType) => {
  const { data, error } = await supabaseClient.rpc("get_recommended", {
    user_id: userId
  })
  if (error) {
    throw new Error("Failed to Fetch Recommended")
  }
  return data
};

// Check Films Friends are Watching or Rating
export const getFriendFilms = async ({supabaseClient, userId}: SelectFriendsFilmRequestType) => {
  const {data, error }= await supabaseClient.rpc("get_friends_films", {
    user_id: userId
  })

  if (error) {
    throw new Error("Failed To Fetch Friend Films")
  }

  return data
};

// Get Films For Search Feature To Get Started
export const getRelatedFilms = async ({
  genres,
  countries,
}: SelectRelatedFilmRequestType) => {
  const fetchSearches = await fetch(
    `${TMDB_API_BASE}/3/discover/movie?with_genres=${genres}&with_origin_country=${countries}&page=1`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
      },
    }
  );

  const searches = await fetchSearches.json();
  return searches;
};
