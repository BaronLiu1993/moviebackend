import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

// Types
type UserRequest = {
  supabaseClient: SupabaseClient;
  userId: UUID;
};

type BookmarkRequest = UserRequest & {
  tmdbId: number;
  title: string;
  genre: string[];
};

type SelectBookmarkRequest = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  page: number;
}

export const selectBookmarkFilms = async ({
  supabaseClient,
  userId,
  page = 0,
}: SelectBookmarkRequest): Promise<any[]> => {
  const LIMIT = 20;
  try {
    const from = (page - 1) * LIMIT;
    const to = from + LIMIT - 1;
    const { data, error } = await supabaseClient
      .from("Bookmarks")
      .select("*")
      .eq("user_id", userId)
      .range(from, to);

    if (error) {
      console.error(`[selectBookmarkFilms] Error fetching bookmarks for user ${userId}:`, error);
      throw new Error(`Failed to fetch bookmarked films: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error(`[selectBookmarkFilms] Exception:`, err);
    throw err;
  }
};

export const bookmarkFilm = async ({
  supabaseClient,
  userId,
  tmdbId,
  title,
  genre,
}: BookmarkRequest): Promise<void> => {
  try {
    const { error } = await supabaseClient
      .from("Bookmarks")
      .insert({
        user_id: userId,
        film_id: tmdbId,
        title: title,
        genre: genre,
      });

    if (error) {
      console.error(`[bookmarkFilm] Error bookmarking film ${tmdbId} for user ${userId}:`, error);
      throw new Error(`Failed to bookmark film: ${error.message}`);
    }
  } catch (err) {
    console.error(`[bookmarkFilm] Exception:`, err);
    throw err;
  }
};

export const removeBookmark = async ({
  supabaseClient,
  userId,
  tmdbId,
}: BookmarkRequest): Promise<void> => {
  try {
    const { error } = await supabaseClient
      .from("Bookmarks")
      .delete()
      .eq("user_id", String(userId))
      .eq("film_id", tmdbId);

    if (error) {
      console.error(`[removeBookmark] Error removing bookmark ${tmdbId} for user ${userId}:`, error);
      throw new Error(`Failed to remove bookmark: ${error.message}`);
    }
  } catch (err) {
    console.error(`[removeBookmark] Exception:`, err);
    throw err;
  }
};