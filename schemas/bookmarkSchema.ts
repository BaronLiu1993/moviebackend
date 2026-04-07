import * as z from "zod";

export const bookmarkFilmRequestSchema = z.object({
  tmdbId: z.number().int(),
  title: z.string().min(1),
  genre_ids: z.array(z.number().int()),
});

export const removeBookmarkRequestSchema = z.object({
  tmdbId: z.number().int(),
});

export const selectBookmarksRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export type BookmarkFilmInput = z.infer<typeof bookmarkFilmRequestSchema>;
export type RemoveBookmarkInput = z.infer<typeof removeBookmarkRequestSchema>;
export type SelectBookmarksInput = z.infer<typeof selectBookmarksRequestSchema>;
