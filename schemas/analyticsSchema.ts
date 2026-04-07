import * as z from "zod";

const impressionSchema = z.object({
    userId: z.uuid(),
    tmdbId: z.number().int(),
    sessionId: z.uuid(),
    position: z.number().int(),
    surface: z.string().min(1),
    film_name: z.string().optional(),
    genre_ids: z.array(z.number().int()).optional(),
    embedding_similarity: z.number().min(-1).max(1).optional(),
    genre_overlap: z.number().min(0).max(1).optional(),
});

export const bulkImpressionsRequestSchema = z.object({
    impressions: z.array(impressionSchema).min(1),
});

export type BulkImpressionsRequest = z.infer<typeof bulkImpressionsRequestSchema>;
