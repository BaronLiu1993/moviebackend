import * as z from "zod";

// Enforce Schemas for Request and Response

const insertRatingRequestSchema = z.object({
  userId: z.string(),
  tmdbId: z.number(),
  rating: z.number().min(0).max(5),
  name: z.string(),
  genre_ids: z.array(z.number())
});

const ratingResponseSchema = z.object({
  userId: z.uuid(),
  tmdbId: z.number(),
  rating: z.number().min(0).max(5),
  name: z.string(),
  genre_ids: z.array(z.number())
});

export type InsertRatingInput = z.infer<typeof insertRatingRequestSchema>;
export type RatingResponse = z.infer<typeof ratingResponseSchema>;

export { insertRatingRequestSchema, ratingResponseSchema };