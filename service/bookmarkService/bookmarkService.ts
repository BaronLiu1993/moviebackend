import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

// Types
export type UserRequest = {
  supabaseClient: SupabaseClient;
  userId: UUID;
};

export type BookmarkRequest = UserRequest & {
  filmId: number;
  title: string;
  genre: string[];
};

export const selectBookmarks = async ({
  supabaseClient,
  userId,
}: UserRequest): Promise<any[]> => {
  try {
    const { data, error } = await supabaseClient
      .from("Bookmarks")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error(`[selectBookmarks] Error fetching bookmarks for user ${userId}:`, error);
      throw new Error(`Failed to fetch bookmarks: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error(`[selectBookmarks] Exception:`, err);
    throw err;
  }
};

export const bookmarkFilm = async ({
  supabaseClient,
  userId,
  filmId,
  title,
  genre,
}: BookmarkRequest): Promise<void> => {
  try {
    const { error } = await supabaseClient
      .from("Bookmarks")
      .insert({
        user_id: userId,
        film_id: filmId,
        title: title,
        genre: genre,
      });

    if (error) {
      console.error(`[bookmarkFilm] Error bookmarking film ${filmId} for user ${userId}:`, error);
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
  filmId,
}: BookmarkRequest): Promise<void> => {
  try {
    const { error } = await supabaseClient
      .from("Bookmarks")
      .delete()
      .eq("user_id", String(userId))
      .eq("film_id", filmId);

    if (error) {
      console.error(`[removeBookmark] Error removing bookmark ${filmId} for user ${userId}:`, error);
      throw new Error(`Failed to remove bookmark: ${error.message}`);
    }
  } catch (err) {
    console.error(`[removeBookmark] Exception:`, err);
    throw err;
  }
};