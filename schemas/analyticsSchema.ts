import * as z from "zod";

export const bookmarkRequestSchema = z.object({
    userId: z.string().uuid(),
    tmdbId: z.number().int(),
    film_name: z.string().min(1),
    genre_ids: z.array(z.number().int()).optional(),
});

export const likeRequestSchema = z.object({
    userId: z.string().uuid(),
    tmdbId: z.number().int(),
    film_name: z.string().min(1),
    genre_ids: z.array(z.number().int()).optional(),
});

const impressionSchema = z.object({
    userId: z.string().uuid(),
    tmdbId: z.number().int(),
    sessionId: z.string().uuid(),
    position: z.number().int(),
    surface: z.string().min(1),
    film_name: z.string().optional(),
    genre_ids: z.array(z.number().int()).optional(),
});

export const bulkImpressionsRequestSchema = z.object({
    impressions: z.array(impressionSchema).min(1),
});

export type BookmarkRequest = z.infer<typeof bookmarkRequestSchema>;
export type LikeRequest = z.infer<typeof likeRequestSchema>;
export type BulkImpressionsRequest = z.infer<typeof bulkImpressionsRequestSchema>;
