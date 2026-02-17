import { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
type SelectRatingType = {
    supabaseClient: SupabaseClient;
    userId: UUID;
};
type InsertRatingType = {
    supabaseClient: SupabaseClient;
    rating: number;
    note: string;
    userId: UUID;
    filmId: number;
    name: string;
    genre: string[];
    accessToken: string;
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
export declare const selectRatings: ({ userId, supabaseClient, }: SelectRatingType) => Promise<any[]>;
export declare const insertRating: ({ supabaseClient, rating, note, name, genre, userId, filmId, accessToken, }: InsertRatingType) => Promise<void>;
export declare const deleteRating: ({ ratingId, userId, supabaseClient, accessToken, }: DeleteRatingType) => Promise<void>;
export declare const updateRating: ({ ratingId, userId, newRating, supabaseClient, accessToken, newNote, }: UpdateRatingType) => Promise<void>;
export {};
//# sourceMappingURL=rateService.d.ts.map