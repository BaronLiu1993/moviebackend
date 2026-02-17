/*
 * It combines Supabase RPCs and tables with OpenAI embeddings
 * and TMDB metadata to manage personalized film recommendations.
*/
import { SupabaseClient } from "@supabase/supabase-js";
import { handleRating } from "../analytics/analyticsService.js";
import updateEmbeddingQueue from "../../queue/updateEmbedding/updateEmbeddingQueue.js";
export const selectRatings = async ({ userId, supabaseClient, }) => {
    const { data, error } = await supabaseClient
        .from("Ratings")
        .select()
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error)
        throw new Error("Failed to select ratings");
    return data;
};
export const insertRating = async ({ supabaseClient, rating, note, name, genre, userId, filmId, accessToken, }) => {
    const { data: existingRating, error: fetchError } = await supabaseClient
        .from("Ratings")
        .select("rating_id")
        .eq("user_id", userId)
        .eq("film_id", filmId)
        .single();
    if (fetchError && fetchError.code !== "PGRST116") {
        console.error(`[insertRating] Error checking existing rating for user ${userId} and film ${filmId}:`, fetchError);
        throw new Error("Failed to check existing rating");
    }
    if (existingRating) {
        throw new Error("User has already rated this film");
    }
    // Add data base constraint the combination of user_id and film_id must be unique
    const { error: insertError } = await supabaseClient.from("Ratings").insert({
        user_id: userId,
        rating,
        note,
        film_name: name,
        film_id: filmId,
        genre
    });
    //await handleRating({ userId, filmId, rating, name, genre });
    console.log(insertError);
    if (insertError)
        throw new Error("Failed to insert rating");
    await updateEmbeddingQueue.add('recompute', { userId, accessToken, operation: 'insert', filmId, rating });
};
export const deleteRating = async ({ ratingId, userId, supabaseClient, accessToken, }) => {
    // Verify rating belongs to user and fetch film_id + rating for incremental update
    const { data: ratingData, error: fetchError } = await supabaseClient
        .from("Ratings")
        .select("user_id, film_id, rating")
        .eq("rating_id", ratingId)
        .single();
    if (fetchError || !ratingData)
        throw new Error("Rating not found");
    if (ratingData.user_id !== userId)
        throw new Error("Unauthorized");
    const { error: deleteError } = await supabaseClient
        .from("Ratings")
        .delete()
        .eq("rating_id", ratingId);
    if (deleteError)
        throw new Error("Failed to delete rating");
    await updateEmbeddingQueue.add('recompute', {
        userId,
        accessToken,
        operation: 'delete',
        filmId: ratingData.film_id,
        rating: ratingData.rating,
    });
};
export const updateRating = async ({ ratingId, userId, newRating, supabaseClient, accessToken, newNote, }) => {
    // Verify rating belongs to user and fetch film_id + old rating for incremental update
    const { data: ratingData, error: fetchError } = await supabaseClient
        .from("Ratings")
        .select("user_id, film_id, rating")
        .eq("rating_id", ratingId)
        .single();
    if (fetchError || !ratingData)
        throw new Error("Rating not found");
    if (ratingData.user_id !== userId)
        throw new Error("Unauthorized");
    // Update the rating
    const { error: updateError } = await supabaseClient
        .from("Ratings")
        .update({ rating: newRating, note: newNote })
        .eq("rating_id", ratingId);
    if (updateError)
        throw new Error("Failed to update rating");
    await updateEmbeddingQueue.add('recompute', {
        userId,
        accessToken,
        operation: 'update',
        filmId: ratingData.film_id,
        rating: newRating,
        oldRating: ratingData.rating,
    });
};
//# sourceMappingURL=rateService.js.map