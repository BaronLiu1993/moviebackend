import * as z from "zod";

export const insertRatingRequestSchema = z.object({
  tmdbId: z.number().int(),
  rating: z.number().int().min(1).max(5),
  note: z.string().min(10).max(500),
  name: z.string().min(1),
  genre_ids: z.array(z.number().int()),
  hasImage: z.boolean().optional().default(false),
});

export const updateRatingRequestSchema = z.object({
  ratingId: z.uuid(),
  newRating: z.number().int().min(1).max(5),
  newNote: z.string().min(10).max(500),
});

export const deleteRatingRequestSchema = z.object({
  ratingId: z.uuid(),
});

export const ratingResponseSchema = z.object({
  userId: z.uuid(),
  tmdbId: z.number(),
  rating: z.number().min(0).max(5),
  name: z.string(),
  genre_ids: z.array(z.number()),
});

export const likeRequestSchema = z.object({
  tmdbId: z.number().int(),
  film_name: z.string().min(1),
  genre_ids: z.array(z.number().int()),
});

export const unlikeRequestSchema = z.object({
  tmdbId: z.number().int(),
});

export type InsertRatingInput = z.infer<typeof insertRatingRequestSchema>;
export type UpdateRatingInput = z.infer<typeof updateRatingRequestSchema>;
export type DeleteRatingInput = z.infer<typeof deleteRatingRequestSchema>;
export type RatingResponse = z.infer<typeof ratingResponseSchema>;
export const likeRatingRequestSchema = z.object({
  ratingId: z.string().uuid(),
});

export const unlikeRatingRequestSchema = z.object({
  ratingId: z.string().uuid(),
});

export type LikeRequest = z.infer<typeof likeRequestSchema>;
export type UnlikeRequest = z.infer<typeof unlikeRequestSchema>;
export type LikeRatingRequest = z.infer<typeof likeRatingRequestSchema>;
export type UnlikeRatingRequest = z.infer<typeof unlikeRatingRequestSchema>;