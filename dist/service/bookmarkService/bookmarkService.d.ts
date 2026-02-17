import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
type UserRequest = {
    supabaseClient: SupabaseClient;
    userId: UUID;
};
type BookmarkRequest = UserRequest & {
    filmId: number;
};
export declare const bookmarkFilm: ({ supabaseClient, userId, filmId, }: BookmarkRequest) => Promise<void>;
export declare const removeBookmark: ({ supabaseClient, userId, filmId, }: BookmarkRequest) => Promise<void>;
export {};
//# sourceMappingURL=bookmarkService.d.ts.map