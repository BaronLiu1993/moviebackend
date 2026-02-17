/**
 * Friend management service layer.
 * Handles friend requests (send/accept/reject), fetches followers/following, and friend profiles.
 * Request operations return boolean: true if successful, false if invalid or failed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
type SendFriendRequest = {
    supabaseClient: SupabaseClient;
    userId: UUID;
    friendId: UUID;
};
type FriendActionRequest = {
    supabaseClient: SupabaseClient;
    userId: UUID;
    requestId: UUID;
};
type GetFollowersRequest = {
    supabaseClient: SupabaseClient;
    userId: UUID;
    page?: number;
    pageSize?: number;
};
type GetProfileRequest = {
    supabaseClient: SupabaseClient;
    userId: UUID;
    friendId: UUID;
};
type EnhanceProfileRequest = {
    supabaseClient: SupabaseClient;
    userId: UUID;
    friendId: UUID;
    filmId: number;
};
export declare const sendFriendRequest: ({ userId, friendId, supabaseClient, }: SendFriendRequest) => Promise<boolean>;
export declare const acceptFriendRequest: ({ userId, requestId, supabaseClient, }: FriendActionRequest) => Promise<void>;
export declare const rejectFriendRequest: ({ userId, requestId, supabaseClient, }: FriendActionRequest) => Promise<void>;
export declare const getFollowers: ({ userId, supabaseClient, page, pageSize, }: GetFollowersRequest) => Promise<{
    request_id: any;
    user_id: any;
    status: any;
}[]>;
export declare const getFriendRequests: ({ userId, supabaseClient, }: GetFollowersRequest) => Promise<{
    request_id: any;
    user_id: any;
    status: any;
    friend_id: any;
}[]>;
export declare const getFollowing: ({ userId, supabaseClient, page, pageSize, }: GetFollowersRequest) => Promise<{
    request_id: any;
    friend_id: any;
    status: any;
}[]>;
export declare const getProfile: ({ userId, friendId, supabaseClient, }: GetProfileRequest) => Promise<{
    ratings: {
        film_id: any;
        rating: any;
        note: any;
        film_name: any;
    }[];
    profile: {
        genre: any;
        movie: any;
    };
}>;
export declare const enhanceFriendProfile: ({ userId, friendId, filmId, supabaseClient, }: EnhanceProfileRequest) => Promise<void>;
export {};
//# sourceMappingURL=friendService.d.ts.map