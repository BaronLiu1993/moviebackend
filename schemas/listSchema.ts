import * as z from "zod";

export const createListSchema = z.object({
  name: z.string().min(1).max(100),
});

export const deleteListSchema = z.object({
  listId: z.string().uuid(),
});

export const renameListSchema = z.object({
  listId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export const addListItemSchema = z.object({
  listId: z.string().uuid(),
  tmdbId: z.number().int(),
  title: z.string().min(1),
  genre_ids: z.array(z.number().int()),
  poster_url: z.string().url(),
});

export const removeListItemSchema = z.object({
  listId: z.string().uuid(),
  tmdbId: z.number().int(),
});

export const getListItemsQuerySchema = z.object({
  listId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const inviteToListSchema = z.object({
  listId: z.string().uuid(),
  friendId: z.string().uuid(),
});

export const respondToInviteSchema = z.object({
  listId: z.string().uuid(),
});

export const removeMemberSchema = z.object({
  listId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const getListMembersQuerySchema = z.object({
  listId: z.string().uuid(),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type DeleteListInput = z.infer<typeof deleteListSchema>;
export type RenameListInput = z.infer<typeof renameListSchema>;
export type AddListItemInput = z.infer<typeof addListItemSchema>;
export type RemoveListItemInput = z.infer<typeof removeListItemSchema>;
export type GetListItemsQuery = z.infer<typeof getListItemsQuerySchema>;
export type InviteToListInput = z.infer<typeof inviteToListSchema>;
export type RespondToInviteInput = z.infer<typeof respondToInviteSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type GetListMembersQuery = z.infer<typeof getListMembersQuerySchema>;
