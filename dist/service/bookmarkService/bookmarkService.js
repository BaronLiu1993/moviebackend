export const bookmarkFilm = async ({ supabaseClient, userId, filmId, }) => {
    try {
        const { error } = await supabaseClient.from("bookmarks").insert({
            user_id: userId,
            film_id: filmId,
        });
        if (error) {
            console.error(`[bookmarkFilm] Error bookmarking film ${filmId} for user ${userId}:`, error);
            throw new Error(`Failed to bookmark film: ${error.message}`);
        }
    }
    catch (err) {
        console.error(`[bookmarkFilm] Exception:`, err);
        throw err;
    }
};
export const removeBookmark = async ({ supabaseClient, userId, filmId, }) => {
    try {
        const { error } = await supabaseClient
            .from("bookmarks")
            .delete()
            .eq("user_id", userId)
            .eq("film_id", filmId);
        if (error) {
            console.error(`[unbookmarkFilm] Error unbookmarking film ${filmId} for user ${userId}:`, error);
            throw new Error(`Failed to unbookmark film: ${error.message}`);
        }
    }
    catch (err) {
        console.error(`[unbookmarkFilm] Exception:`, err);
        throw err;
    }
};
//# sourceMappingURL=bookmarkService.js.map