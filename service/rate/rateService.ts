import { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
import { insertInteractionEvents } from "../clickhouse/clickhouseService.js";
import { checkIsFriends } from "../friend/friendService.js";
import { signImageUrls } from "../storage/signedUrl.js";
import updateEmbeddingQueue from "../../queue/updateEmbedding/updateEmbeddingQueue.js";

type SelectRatingType = { 
  supabaseClient: SupabaseClient; 
  userId: UUID 
};

type InsertRatingType = {
  supabaseClient: SupabaseClient;
  rating: number;
  note: string;
  userId: UUID;
  tmdbId: number;
  name: string;
  genre_ids: number[];
  accessToken: string;
  hasImage?: boolean;
};

type UpdateRatingType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  ratingId: UUID;
  newRating: number;
  newNote: string;  
  accessToken: string;
};

type DeleteRatingType = {
  supabaseClient: SupabaseClient;
  ratingId: UUID;
  userId: UUID;
  accessToken: string;
};

export const selectRatings = async ({
  userId,
  supabaseClient,
}: SelectRatingType) => {
  const { data, error } = await supabaseClient
    .from("Ratings")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to select ratings");
  return signImageUrls(supabaseClient, data ?? []);
};

export const insertRating = async ({
  supabaseClient,
  rating,
  note,
  name,
  genre_ids,
  userId,
  tmdbId,
  accessToken,
  hasImage = false,
}: InsertRatingType) => {

  const { data: existingRating, error: fetchError } = await supabaseClient
    .from("Ratings")
    .select("rating_id")
    .eq("user_id", userId)
    .eq("tmdb_id", tmdbId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error(`[insertRating] Error checking existing rating for user ${userId} and film ${tmdbId}:`, fetchError);
    throw new Error("Failed to check existing rating");
  }

  if (existingRating) {
    throw new Error("User has already rated this film");
  }

  let imageUrl: string | null = null;

  if (hasImage) {
    imageUrl = `ratings/${userId}/${tmdbId}.jpg`;
  } else {
    // Fall back to the film's poster from Guanghai
    const { data: film } = await supabaseClient
      .from("Guanghai")
      .select("photo_url")
      .eq("tmdb_id", tmdbId)
      .single();

    imageUrl = film?.photo_url ?? null;
  }

  const { data: insertedRating, error: insertError } = await supabaseClient
    .from("Ratings")
    .insert({
      user_id: userId,
      rating: rating,
      note: note,
      film_name: name,
      tmdb_id: tmdbId,
      genre_ids: genre_ids,
      image_url: imageUrl,
    })
    .select("rating_id")
    .single();

  if (insertError) throw new Error("Failed to insert rating");

  // Generate presigned upload URL if image is expected
  let uploadUrl: string | null = null;

  if (hasImage && imageUrl) {
    const { data: signedData, error: signError } = await supabaseClient.storage
      .from("rating-images")
      .createSignedUploadUrl(imageUrl);

    if (signError) {
      console.error(`[insertRating] Failed to create upload URL:`, signError);
    } else {
      uploadUrl = signedData.signedUrl;
    }
  }

  await insertInteractionEvents({ userId, tmdbId, interactionType: "rating", rating, film_name: name, genre_ids });
  await updateEmbeddingQueue.add('recompute', { userId, accessToken, operation: 'insert', tmdbId, rating });

  return { ratingId: insertedRating?.rating_id, uploadUrl };
};

export const deleteRating = async ({
  ratingId,
  userId,
  supabaseClient,
  accessToken,
}: DeleteRatingType) => {
  // Verify rating belongs to user and fetch film_id + rating for incremental update
  const { data: ratingData, error: fetchError } = await supabaseClient
    .from("Ratings")
    .select("user_id, tmdb_id, rating")
    .eq("rating_id", ratingId)
    .single();

  if (fetchError || !ratingData) throw new Error("Rating not found");
  if (ratingData.user_id !== userId) throw new Error("Unauthorized");

  const { error: deleteError } = await supabaseClient
    .from("Ratings")
    .delete()
    .eq("rating_id", ratingId);

  if (deleteError) throw new Error("Failed to delete rating");

  await insertInteractionEvents({ userId, tmdbId: ratingData.tmdb_id, interactionType: "rating", rating: 0 });
  await updateEmbeddingQueue.add('recompute', {
    userId,
    accessToken,
    operation: 'delete',
    tmdbId: ratingData.tmdb_id,
    rating: ratingData.rating,
  });
};

export const updateRating = async ({
  ratingId,
  userId,
  newRating,
  supabaseClient,
  accessToken,
  newNote,
}: UpdateRatingType) => {
  const { data: ratingData, error: fetchError } = await supabaseClient
    .from("Ratings")
    .select("user_id, tmdb_id, rating")
    .eq("rating_id", ratingId)
    .single();

  if (fetchError || !ratingData) throw new Error("Rating not found");
  if (ratingData.user_id !== userId) throw new Error("Unauthorized");

  // Update the rating
  const { error: updateError } = await supabaseClient
    .from("Ratings")
    .update({ rating: newRating, note: newNote })
    .eq("rating_id", ratingId);

  if (updateError) throw new Error("Failed to update rating");

  await insertInteractionEvents({ userId, tmdbId: ratingData.tmdb_id, interactionType: "rating", rating: newRating });
  await updateEmbeddingQueue.add('recompute', {
    userId,
    accessToken,
    operation: 'update',
    tmdbId: ratingData.tmdb_id,
    rating: newRating,
    oldRating: ratingData.rating,
  });
};

type LikeRatingType = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  ratingId: UUID;
};

export const likeRating = async ({ supabaseClient, userId, ratingId }: LikeRatingType) => {
  try {
    const { data: rating, error: fetchError } = await supabaseClient
      .from("Ratings")
      .select("user_id, like_count, tmdb_id, film_name, genre_ids")
      .eq("rating_id", ratingId)
      .single();

    if (fetchError || !rating) {
      console.error(`[likeRating] Rating ${ratingId} not found:`, fetchError);
      throw new Error("Rating not found");
    }

    if (rating.user_id === userId) {
      throw new Error("Cannot like your own rating");
    }

    const isFriend = await checkIsFriends(supabaseClient, userId, rating.user_id);
    if (!isFriend) {
      throw new Error("Users are not friends");
    }

    const { error: insertError } = await supabaseClient
      .from("Rating_Likes")
      .insert({ rating_id: ratingId, user_id: userId });

    if (insertError) {
      if (insertError.code === "23505") throw new Error("Already liked this rating");
      console.error(`[likeRating] Insert error:`, insertError);
      throw new Error("Failed to like rating");
    }

    await supabaseClient
      .from("Ratings")
      .update({ like_count: (rating.like_count ?? 0) + 1 })
      .eq("rating_id", ratingId);

    await insertInteractionEvents({
      userId,
      tmdbId: rating.tmdb_id,
      interactionType: "rating_like",
      rating_id: ratingId,
      film_name: rating.film_name,
      genre_ids: rating.genre_ids,
      rating: 0,
    });
  } catch (err) {
    console.error(`[likeRating] Exception:`, err);
    throw err;
  }
};

export const unlikeRating = async ({ supabaseClient, userId, ratingId }: LikeRatingType) => {
  try {
    const { error: deleteError } = await supabaseClient
      .from("Rating_Likes")
      .delete()
      .eq("rating_id", ratingId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error(`[unlikeRating] Delete error:`, deleteError);
      throw new Error("Failed to unlike rating");
    }

    // Decrement like_count (floor at 0)
    const { data: rating } = await supabaseClient
      .from("Ratings")
      .select("like_count")
      .eq("rating_id", ratingId)
      .single();

    if (rating) {
      await supabaseClient
        .from("Ratings")
        .update({ like_count: Math.max((rating.like_count ?? 0) - 1, 0) })
        .eq("rating_id", ratingId);
    }
  } catch (err) {
    console.error(`[unlikeRating] Exception:`, err);
    throw err;
  }
};
