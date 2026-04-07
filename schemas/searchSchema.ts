import * as z from "zod";

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  media_type: z.enum(["tv", "movie"]).optional(),
  genre_ids: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(",").map(Number).filter((n) => !isNaN(n)) : undefined,
    ),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
