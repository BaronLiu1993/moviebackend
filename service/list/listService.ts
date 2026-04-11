import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
import { insertInteractionEvents } from "../clickhouse/clickhouseService.js";
import { checkIsFriends } from "../friend/friendService.js";
import { signImageUrls } from "../storage/signedUrl.js";
import updateEmbeddingQueue from "../../queue/updateEmbedding/updateEmbeddingQueue.js";

const LIST_ADD_IMPLICIT_RATING = 1;

type UserRequest = {
  supabaseClient: SupabaseClient;
  userId: UUID;
};

type CreateListRequest = UserRequest & { name: string; hasImage?: boolean };
type DeleteListRequest = UserRequest & { listId: UUID };
type RenameListRequest = UserRequest & { listId: UUID; name: string };

type AddListItemRequest = UserRequest & {
  listId: UUID;
  tmdbId: number;
  title: string;
  genre_ids: number[];
  poster_url: string;
  accessToken: string;
};

type RemoveListItemRequest = UserRequest & {
  listId: UUID;
  tmdbId: number;
  accessToken: string;
};

type GetListItemsRequest = UserRequest & {
  listId: UUID;
  page: number;
  pageSize: number;
};

type InviteRequest = UserRequest & { listId: UUID; friendId: UUID };
type InviteResponseRequest = UserRequest & { listId: UUID };
type RemoveMemberRequest = UserRequest & { listId: UUID; targetUserId: UUID };
type GetMembersRequest = UserRequest & { listId: UUID };

// --- Access control helper ---

export const getListRole = async (
  supabaseClient: SupabaseClient,
  userId: UUID,
  listId: UUID,
): Promise<"owner" | "collaborator" | null> => {
  const { data, error } = await supabaseClient
    .from("List_Members")
    .select("role")
    .eq("list_id", listId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .single();

  if (error || !data) return null;
  return data.role as "owner" | "collaborator";
};

const requireRole = async (
  supabaseClient: SupabaseClient,
  userId: UUID,
  listId: UUID,
  allowed: ("owner" | "collaborator")[],
): Promise<"owner" | "collaborator"> => {
  const role = await getListRole(supabaseClient, userId, listId);
  if (!role || !allowed.includes(role)) throw new Error("Access denied");
  return role;
};

const isDefaultList = async (
  supabaseClient: SupabaseClient,
  listId: UUID,
): Promise<boolean> => {
  const { data } = await supabaseClient
    .from("Lists")
    .select("is_default")
    .eq("list_id", listId)
    .single();
  return data?.is_default === true;
};

export const createDefaultWatchlist = async ({ supabaseClient, userId }: UserRequest) => {
  const { data, error } = await supabaseClient
    .from("Lists")
    .insert({ user_id: userId, name: "Watchlist", is_default: true })
    .select()
    .single();

  if (error) {
    console.error(`[createDefaultWatchlist] Error for user ${userId}:`, error);
    throw new Error(`Failed to create default watchlist: ${error.message}`);
  }

  return data;
};

const DEFAULT_LIST_IMAGE = "https://image.tmdb.org/t/p/w500/placeholder.jpg";

export const createList = async ({ supabaseClient, userId, name, hasImage = false }: CreateListRequest) => {
  const imagePath = hasImage ? `lists/${userId}/${Date.now()}.jpg` : null;
  const imageUrl = imagePath ?? DEFAULT_LIST_IMAGE;

  const { data, error } = await supabaseClient
    .from("Lists")
    .insert({ user_id: userId, name, is_default: false, image_url: imageUrl })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("A list with this name already exists");
    console.error(`[createList] Error for user ${userId}:`, error);
    throw new Error(`Failed to create list: ${error.message}`);
  }

  await supabaseClient
    .from("List_Members")
    .insert({ list_id: data.list_id, user_id: userId, role: "owner", status: "accepted" });

  let uploadUrl: string | null = null;

  if (hasImage && imagePath) {
    const { data: signedData, error: signError } = await supabaseClient.storage
      .from("list-images")
      .createSignedUploadUrl(imagePath);

    if (signError) {
      console.error(`[createList] Failed to create upload URL:`, signError);
    } else {
      uploadUrl = signedData.signedUrl;
    }
  }

  return { ...data, uploadUrl };
};

export const getUserLists = async ({ supabaseClient, userId }: UserRequest) => {
  // Get lists user owns directly (including default Watchlist)
  const { data: ownedLists, error: ownedError } = await supabaseClient
    .from("Lists")
    .select("list_id, name, is_default, user_id, image_url, created_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (ownedError) {
    console.error(`[getUserLists] Error fetching owned lists for ${userId}:`, ownedError);
    throw new Error(`Failed to fetch lists: ${ownedError.message}`);
  }

  // Get lists user is a collaborator on
  const { data: memberships, error: memberError } = await supabaseClient
    .from("List_Members")
    .select("list_id")
    .eq("user_id", userId)
    .eq("role", "collaborator")
    .eq("status", "accepted");

  if (memberError) {
    console.error(`[getUserLists] Error fetching memberships for ${userId}:`, memberError);
    throw new Error(`Failed to fetch memberships: ${memberError.message}`);
  }

  const collaboratedListIds = (memberships ?? []).map((m) => m.list_id);

  let collaboratedLists: any[] = [];
  if (collaboratedListIds.length > 0) {
    const { data, error } = await supabaseClient
      .from("Lists")
      .select("list_id, name, is_default, user_id, image_url, created_at")
      .in("list_id", collaboratedListIds);

    if (error) {
      console.error(`[getUserLists] Error fetching collaborated lists:`, error);
      throw new Error(`Failed to fetch collaborated lists: ${error.message}`);
    }
    collaboratedLists = data ?? [];
  }

  const allLists = [...(ownedLists ?? []), ...collaboratedLists];
  return signImageUrls(supabaseClient, allLists);
};

export const deleteList = async ({ supabaseClient, userId, listId }: DeleteListRequest) => {
  await requireRole(supabaseClient, userId, listId, ["owner"]);

  if (await isDefaultList(supabaseClient, listId)) {
    throw new Error("Cannot delete the default Watchlist");
  }

  const { error } = await supabaseClient
    .from("Lists")
    .delete()
    .eq("list_id", listId);

  if (error) {
    console.error(`[deleteList] Error for list ${listId}:`, error);
    throw new Error(`Failed to delete list: ${error.message}`);
  }
};

export const renameList = async ({ supabaseClient, userId, listId, name }: RenameListRequest) => {
  await requireRole(supabaseClient, userId, listId, ["owner"]);

  if (await isDefaultList(supabaseClient, listId)) {
    throw new Error("Cannot rename the default Watchlist");
  }

  const { error } = await supabaseClient
    .from("Lists")
    .update({ name })
    .eq("list_id", listId);

  if (error) {
    if (error.code === "23505") throw new Error("A list with this name already exists");
    console.error(`[renameList] Error for list ${listId}:`, error);
    throw new Error(`Failed to rename list: ${error.message}`);
  }
};

// --- List Items ---

export const addListItem = async ({
  supabaseClient, userId, listId, tmdbId, title, genre_ids, poster_url, accessToken,
}: AddListItemRequest) => {
  // Default watchlist: check ownership directly. Custom list: check via List_Members.
  const isDefault = await isDefaultList(supabaseClient, listId);
  if (isDefault) {
    const { data } = await supabaseClient
      .from("Lists")
      .select("user_id")
      .eq("list_id", listId)
      .single();
    if (data?.user_id !== userId) throw new Error("Access denied");
  } else {
    await requireRole(supabaseClient, userId, listId, ["owner", "collaborator"]);
  }

  const { error } = await supabaseClient
    .from("List_Items")
    .insert({ list_id: listId, user_id: userId, tmdb_id: tmdbId, title, genre_ids, poster_url });

  if (error) {
    if (error.code === "23505") throw new Error("Film already in this list");
    console.error(`[addListItem] Error adding film ${tmdbId} to list ${listId}:`, error);
    throw new Error(`Failed to add film to list: ${error.message}`);
  }

  await insertInteractionEvents({
    userId, tmdbId, interactionType: "bookmark", film_name: title, genre_ids, rating: 0,
  });
  await updateEmbeddingQueue.add("recompute", {
    userId, accessToken, operation: "insert", tmdbId, rating: LIST_ADD_IMPLICIT_RATING,
  });
};

export const removeListItem = async ({
  supabaseClient, userId, listId, tmdbId, accessToken,
}: RemoveListItemRequest) => {
  const isDefault = await isDefaultList(supabaseClient, listId);
  if (isDefault) {
    const { data } = await supabaseClient
      .from("Lists")
      .select("user_id")
      .eq("list_id", listId)
      .single();
    if (data?.user_id !== userId) throw new Error("Access denied");
  } else {
    const role = await requireRole(supabaseClient, userId, listId, ["owner", "collaborator"]);

    // Collaborators can only remove items they added
    if (role === "collaborator") {
      const { data: item } = await supabaseClient
        .from("List_Items")
        .select("user_id")
        .eq("list_id", listId)
        .eq("tmdb_id", tmdbId)
        .single();

      if (item?.user_id !== userId) throw new Error("Can only remove items you added");
    }
  }

  const { error } = await supabaseClient
    .from("List_Items")
    .delete()
    .eq("list_id", listId)
    .eq("tmdb_id", tmdbId);

  if (error) {
    console.error(`[removeListItem] Error removing film ${tmdbId} from list ${listId}:`, error);
    throw new Error(`Failed to remove film from list: ${error.message}`);
  }

  await insertInteractionEvents({ userId, tmdbId, interactionType: "bookmark", rating: 0 });
  await updateEmbeddingQueue.add("recompute", {
    userId, accessToken, operation: "delete", tmdbId, rating: LIST_ADD_IMPLICIT_RATING,
  });
};

export const getListItems = async ({
  supabaseClient, userId, listId, page, pageSize,
}: GetListItemsRequest) => {
  const isDefault = await isDefaultList(supabaseClient, listId);
  if (isDefault) {
    const { data } = await supabaseClient
      .from("Lists")
      .select("user_id")
      .eq("list_id", listId)
      .single();
    if (data?.user_id !== userId) throw new Error("Access denied");
  } else {
    await requireRole(supabaseClient, userId, listId, ["owner", "collaborator"]);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabaseClient
    .from("List_Items")
    .select("item_id, tmdb_id, title, genre_ids, poster_url, user_id, created_at")
    .eq("list_id", listId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error(`[getListItems] Error for list ${listId}:`, error);
    throw new Error(`Failed to fetch list items: ${error.message}`);
  }

  return data;
};

// --- List Members (collaborative) ---

export const inviteToList = async ({ supabaseClient, userId, listId, friendId }: InviteRequest) => {
  await requireRole(supabaseClient, userId, listId, ["owner"]);

  if (await isDefaultList(supabaseClient, listId)) {
    throw new Error("Cannot share the default Watchlist");
  }

  const isFriend = await checkIsFriends(supabaseClient, userId, friendId);
  if (!isFriend) throw new Error("Can only invite friends");

  const { error } = await supabaseClient
    .from("List_Members")
    .insert({ list_id: listId, user_id: friendId, role: "collaborator", status: "pending", invited_by: userId });

  if (error) {
    if (error.code === "23505") throw new Error("User already invited to this list");
    console.error(`[inviteToList] Error:`, error);
    throw new Error(`Failed to invite user: ${error.message}`);
  }
};

export const acceptListInvite = async ({ supabaseClient, userId, listId }: InviteResponseRequest) => {
  const { data, error: fetchError } = await supabaseClient
    .from("List_Members")
    .select("member_id, status")
    .eq("list_id", listId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .single();

  if (fetchError || !data) throw new Error("No pending invite found");

  const { error } = await supabaseClient
    .from("List_Members")
    .update({ status: "accepted" })
    .eq("member_id", data.member_id);

  if (error) {
    console.error(`[acceptListInvite] Error:`, error);
    throw new Error(`Failed to accept invite: ${error.message}`);
  }
};

export const declineListInvite = async ({ supabaseClient, userId, listId }: InviteResponseRequest) => {
  const { data, error: fetchError } = await supabaseClient
    .from("List_Members")
    .select("member_id, status")
    .eq("list_id", listId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .single();

  if (fetchError || !data) throw new Error("No pending invite found");

  const { error } = await supabaseClient
    .from("List_Members")
    .delete()
    .eq("member_id", data.member_id);

  if (error) {
    console.error(`[declineListInvite] Error:`, error);
    throw new Error(`Failed to decline invite: ${error.message}`);
  }
};

export const removeMember = async ({ supabaseClient, userId, listId, targetUserId }: RemoveMemberRequest) => {
  await requireRole(supabaseClient, userId, listId, ["owner"]);

  if (targetUserId === userId) throw new Error("Cannot remove yourself as owner");

  const { error } = await supabaseClient
    .from("List_Members")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", targetUserId)
    .eq("role", "collaborator");

  if (error) {
    console.error(`[removeMember] Error:`, error);
    throw new Error(`Failed to remove member: ${error.message}`);
  }
};

export const getListMembers = async ({ supabaseClient, userId, listId }: GetMembersRequest) => {
  await requireRole(supabaseClient, userId, listId, ["owner", "collaborator"]);

  const { data, error } = await supabaseClient
    .from("List_Members")
    .select("member_id, user_id, role, status, created_at")
    .eq("list_id", listId);

  if (error) {
    console.error(`[getListMembers] Error:`, error);
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  return data;
};

export const getPendingInvites = async ({ supabaseClient, userId }: UserRequest) => {
  const { data, error } = await supabaseClient
    .from("List_Members")
    .select("list_id, invited_by, created_at")
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) {
    console.error(`[getPendingInvites] Error:`, error);
    throw new Error(`Failed to fetch invites: ${error.message}`);
  }

  return data;
};
