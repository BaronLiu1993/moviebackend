import * as z from "zod";

// Enforce Schemas for Request and Response

export const insertRatingRequestSchema = z.object({
  tmdbId: z.number().int(),
  rating: z.number().int().min(1).max(5),
  note: z.string().min(10).max(500),
  name: z.string().min(1),
  genre_ids: z.array(z.number().int()),
});

export const updateRatingRequestSchema = z.object({
  ratingId: z.string().uuid(),
  newRating: z.number().int().min(1).max(5),
  newNote: z.string().min(10).max(500),
});

export const deleteRatingRequestSchema = z.object({
  ratingId: z.string().uuid(),
});

export const ratingResponseSchema = z.object({
  userId: z.string().uuid(),
  tmdbId: z.number(),
  rating: z.number().min(0).max(5),
  name: z.string(),
  genre_ids: z.array(z.number()),
});

export type InsertRatingInput = z.infer<typeof insertRatingRequestSchema>;
export type UpdateRatingInput = z.infer<typeof updateRatingRequestSchema>;
export type DeleteRatingInput = z.infer<typeof deleteRatingRequestSchema>;
export type RatingResponse = z.infer<typeof ratingResponseSchema>;