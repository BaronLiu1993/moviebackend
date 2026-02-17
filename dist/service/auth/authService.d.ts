/**
 * It acts as the authentication service layer between the API routes,
 * Supabase (auth + database), and OpenAI.
 */
import type { UUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
interface RegisterUserRequest {
    userId: UUID;
    genres: string;
    movies?: string;
    moods?: string;
    dislikedGenres?: string;
    movieIds?: number[];
    supabaseClient: SupabaseClient;
}
export declare const handleSignIn: () => Promise<string>;
export declare const registerUser: ({ userId, genres, movies, moods, dislikedGenres, movieIds, supabaseClient, }: RegisterUserRequest) => Promise<void>;
export {};
//# sourceMappingURL=authService.d.ts.map