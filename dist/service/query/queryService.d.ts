import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
type UserRequest = {
    supabaseClient: SupabaseClient;
    userId: UUID;
};
export declare const getInitialFeed: ({ supabaseClient, userId, }: UserRequest) => Promise<any[]>;
export declare const getFriendFilms: ({ supabaseClient, userId, }: UserRequest) => Promise<any>;
export declare const getFriendsDramas: ({ supabaseClient, userId, }: UserRequest) => Promise<any>;
export declare const getAiringDramas: () => Promise<any>;
export declare const getPopularDramas: () => Promise<any>;
export {};
//# sourceMappingURL=queryService.d.ts.map