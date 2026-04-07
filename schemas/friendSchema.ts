import * as z from "zod";

export const sendFriendRequestSchema = z.object({
    friendId: z.uuid(),
});

export const acceptFriendRequestSchema = z.object({
    requestId: z.uuid(),
});

export const declineFriendRequestSchema = z.object({
    requestId: z.uuid(),
});

export const getProfileQuerySchema = z.object({
    friendId: z.uuid(),
});

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type SendFriendRequest = z.infer<typeof sendFriendRequestSchema>;
export type AcceptFriendRequest = z.infer<typeof acceptFriendRequestSchema>;
export type DeclineFriendRequest = z.infer<typeof declineFriendRequestSchema>;
export type GetProfileQuery = z.infer<typeof getProfileQuerySchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
