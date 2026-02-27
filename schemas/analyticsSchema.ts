import * as z from "zod";

export const bookmarkRequestSchema = z.object({
    userId: z.string().uuid(),
    tmdbId: z.number().int(),
    name: z.string().min(1),
});

export const likeRequestSchema = z.object({
    userId: z.string().uuid(),
    tmdbId: z.number().int(),
    name: z.string().min(1),
});

const impressionSchema = z.object({
    userId: z.string().uuid(),
    tmdbId: z.number().int(),
    name: z.string().min(1),
});

export const bulkImpressionsRequestSchema = z.object({
    impressions: z.array(impressionSchema).min(1),
});

export type BookmarkRequest = z.infer<typeof bookmarkRequestSchema>;
export type LikeRequest = z.infer<typeof likeRequestSchema>;
export type BulkImpressionsRequest = z.infer<typeof bulkImpressionsRequestSchema>;
