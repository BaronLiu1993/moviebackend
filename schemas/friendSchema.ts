import * as z from "zod";

export const sendFriendRequestSchema = z.object({
    friendId: z.string().uuid(),
});

export const acceptFriendRequestSchema = z.object({
    requestId: z.string().uuid(),
});

export const declineFriendRequestSchema = z.object({
    requestId: z.string().uuid(),
});

export const getProfileQuerySchema = z.object({
    friendId: z.string().uuid(),
});

export type SendFriendRequest = z.infer<typeof sendFriendRequestSchema>;
export type AcceptFriendRequest = z.infer<typeof acceptFriendRequestSchema>;
export type DeclineFriendRequest = z.infer<typeof declineFriendRequestSchema>;
export type GetProfileQuery = z.infer<typeof getProfileQuerySchema>;
