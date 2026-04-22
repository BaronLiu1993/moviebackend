import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";
import { randomBytes } from "node:crypto";
import { signImageUrls } from "../storage/signedUrl.js";

// Types
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

// Checks whether two users have an accepted friendship relationship
export const checkIsFriends = async (
  supabaseClient: SupabaseClient,
  userId: UUID,
  friendId: UUID
): Promise<boolean> => {
  try {
    const { data, error } = await supabaseClient.rpc("is_following", {
      p_follower_id: userId,
      p_following_id: friendId,
    });
    if (error) {
      console.error(`[checkIsFriends] Error checking friendship between ${userId} and ${friendId}:`, error);
      throw new Error(`Failed to check friendship status: ${error.message}`);
    }

    return Boolean(data);
  } catch (err) {
    console.error(`[checkIsFriends] Exception:`, err);
    throw err;
  }
};

// Validates that a friend request exists and is pending, returns the request data
const validatePendingRequest = async (
  supabaseClient: SupabaseClient,
  requestId: UUID,
  userId: UUID
) => {
  try {
    const { data, error } = await supabaseClient
      .from("Friends")
      .select("status")
      .eq("request_id", requestId)
      .eq("friend_id", userId)
      .single();

    if (error || !data) {
      console.error(`[validatePendingRequest] Request ${requestId} not found for user ${userId}:`, error);
      throw new Error("Friend request not found");
    }

    if (data.status !== "pending") {
      throw new Error("Only pending friend requests can be modified");
    }
  } catch (err) {
    console.error(`[validatePendingRequest] Exception:`, err);
    throw err;
  }
};

// Sends a friend request with a pending status
export const sendFriendRequest = async ({
  userId,
  friendId,
  supabaseClient,
}: SendFriendRequest): Promise<boolean> => {
  try {
    // Check if user is trying to add themselves
    if (userId === friendId) {
      console.error(`[sendFriendRequest] User ${userId} attempted to send friend request to themselves`);
      throw new Error("Cannot send friend request to yourself");
    }

    // Check if friendId user exists
    const { data: friendExists, error: friendCheckError } = await supabaseClient
      .from("User_Profiles")
      .select("user_id")
      .eq("user_id", friendId)
      .single();

    if (friendCheckError || !friendExists) {
      console.error(`[sendFriendRequest] Friend user ${friendId} not found:`, friendCheckError);
      throw new Error("User not found");
    }

    // Check if request already exists (pending or accepted)
    const { data: existingRequest, error: existingError } = await supabaseClient
      .from("Friends")
      .select("request_id, status")
      .eq("user_id", userId)
      .eq("friend_id", friendId)
      .single();

    if (!existingError && existingRequest) {
      console.error(`[sendFriendRequest] Friend request already exists from ${userId} to ${friendId} with status ${existingRequest.status}`);
      throw new Error(`Friend request already ${existingRequest.status}`);
    }

    // Create the friend request
    const { error } = await supabaseClient.from("Friends").insert({
      user_id: userId,
      friend_id: friendId,
      status: "pending",
    });

    if (error) {
      console.error(`[sendFriendRequest] Error creating request from ${userId} to ${friendId}:`, error);
      throw new Error(`Failed to create friend request: ${error.message}`);
    }

    return true;
  } catch (err) {
    console.error(`[sendFriendRequest] Exception:`, err);
    throw new Error("Failed to send friend request");
  }
};

// Accepts a pending friend request
export const acceptFriendRequest = async ({
  userId,
  requestId,
  supabaseClient,
}: FriendActionRequest) => {
  try {
    await validatePendingRequest(supabaseClient, requestId, userId);

    const { error } = await supabaseClient
      .from("Friends")
      .update({ status: "accepted" })
      .eq("request_id", requestId)
      .eq("friend_id", userId);

    if (error) {
      console.error(`[acceptFriendRequest] Error accepting request ${requestId} for user ${userId}:`, error);
      throw new Error(`Failed to accept friend request: ${error.message}`);
    }
  } catch (err) {
    console.error(`[acceptFriendRequest] Exception:`, err);
    throw new Error("Failed to accept friend request");
  }
};

// Rejects (deletes) a pending friend request
export const rejectFriendRequest = async ({
  userId,
  requestId,
  supabaseClient,
}: FriendActionRequest) => {
  try {
    await validatePendingRequest(supabaseClient, requestId, userId);

    const { error } = await supabaseClient
      .from("Friends")
      .delete()
      .eq("request_id", requestId)
      .eq("friend_id", userId);

    if (error) {
      console.error(`[rejectFriendRequest] Error rejecting request ${requestId} for user ${userId}:`, error);
      throw new Error(`Failed to reject friend request: ${error.message}`);
    }
  } catch (err) {
    console.error(`[rejectFriendRequest] Exception:`, err);
    throw new Error("Failed to reject friend request");
  }
};

// Returns incoming pending friend requests (followers)
export const getFollowers = async ({
  userId,
  supabaseClient,
  page = 1,
  pageSize = 10,
}: GetFollowersRequest) => {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabaseClient
      .from("Friends")
      .select("request_id, user_id, status")
      .eq("friend_id", userId)
      .eq("status", "pending")
      .range(from, to);

    if (error) {
      console.error(`[getFollowers] Error fetching followers for user ${userId}:`, error);
      throw new Error(`Failed to fetch followers: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error(`[getFollowers] Exception:`, err);
    throw new Error("Failed to fetch followers");
  }
};

export const getFriendRequests = async ({
  userId,
  supabaseClient,
  page = 1,
  pageSize = 10,
}: GetFollowersRequest) => {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabaseClient
      .from("Friends")
      .select("request_id, user_id, status, friend_id")
      .eq("friend_id", userId)
      .eq("status", "pending")
      .range(from, to);

    if (error) {
      console.error(`[getFriendRequests] Error fetching requests for user ${userId}:`, error);
      throw new Error(`Failed to fetch friend requests: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error(`[getFriendRequests] Exception:`, err);
    throw new Error("Failed to fetch friend requests");
  }
};

// Returns outgoing friend requests and accepted friendships
export const getFollowing = async ({
  userId,
  supabaseClient,
  page = 1,
  pageSize = 10,
}: GetFollowersRequest) => {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabaseClient
      .from("Friends")
      .select("request_id, friend_id, status")
      .eq("user_id", userId)
      .eq("status", "accepted")
      .range(from, to);

    if (error) {
      console.error(`[getFollowing] Error fetching following for user ${userId}:`, error);
      throw new Error(`Failed to fetch following: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error(`[getFollowing] Exception:`, err);
    throw new Error("Failed to fetch following");
  }
};

// Removes an accepted friendship between two users
export const removeFriend = async ({
  userId,
  friendId,
  supabaseClient,
}: SendFriendRequest) => {
  try {
    // Find the accepted friendship row (could be in either direction)
    const { data, error: findError } = await supabaseClient
      .from("Friends")
      .select("request_id")
      .eq("status", "accepted")
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
      .single();

    if (findError || !data) {
      console.error(`[removeFriend] Friendship not found between ${userId} and ${friendId}:`, findError);
      throw new Error("Friendship not found");
    }

    const { error: deleteError } = await supabaseClient
      .from("Friends")
      .delete()
      .eq("request_id", data.request_id);

    if (deleteError) {
      console.error(`[removeFriend] Error removing friendship ${data.request_id}:`, deleteError);
      throw new Error(`Failed to remove friendship: ${deleteError.message}`);
    }
  } catch (err) {
    console.error(`[removeFriend] Exception:`, err);
    throw new Error("Failed to remove friend");
  }
};

// Fetches a friend's profile and ratings if the friendship is accepted
export const getProfile = async ({
  userId,
  friendId,
  supabaseClient,
}: GetProfileRequest) => {
  try {
    const isFriend = await checkIsFriends(supabaseClient, userId, friendId);

    if (!isFriend) {
      throw new Error("Users are not friends");
    }

    const [ratingsResult, profileResult] = await Promise.all([
      supabaseClient
        .from("Ratings")
        .select("rating_id, film_id, rating, note, film_name, like_count")
        .eq("user_id", friendId),
      supabaseClient
        .from("User_Profiles")
        .select("genres, movies")
        .eq("user_id", friendId)
        .single(),
    ]);

    if (ratingsResult.error) {
      console.error(`[getProfile] Error fetching ratings for friend ${friendId}:`, ratingsResult.error);
      throw new Error(`Failed to fetch ratings: ${ratingsResult.error.message}`);
    }

    if (profileResult.error || !profileResult.data) {
      console.error(`[getProfile] Error fetching profile for friend ${friendId}:`, profileResult.error);
      throw new Error(`Failed to fetch user profile: ${profileResult.error?.message}`);
    }

    const ratings = ratingsResult.data;
    const profile = profileResult.data;

    // Enrich ratings with has_liked for the requesting user
    const ratingIds = ratings.map((r: any) => r.rating_id);
    let userLikeSet = new Set<string>();

    if (ratingIds.length > 0) {
      const { data: userLikes } = await supabaseClient
        .from("Rating_Likes")
        .select("rating_id")
        .in("rating_id", ratingIds)
        .eq("user_id", userId);

      userLikeSet = new Set((userLikes ?? []).map((l: any) => l.rating_id));
    }

    const enrichedRatings = ratings.map((r: any) => ({
      ...r,
      has_liked: userLikeSet.has(r.rating_id),
    }));

    const signedRatings = await signImageUrls(supabaseClient, enrichedRatings);

    return {
      ratings: signedRatings,
      profile,
    };
  } catch (err) {
    console.error(`[getProfile] Exception:`, err);
    throw new Error("Failed to fetch friend profile");
  }
};

// --- Friend Feed ---

type GetFriendFeedRequest = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  page?: number;
  pageSize?: number;
};

export const getFriendFeed = async ({
  supabaseClient,
  userId,
  page = 1,
  pageSize = 20,
}: GetFriendFeedRequest) => {
  try {
    // Get all accepted friend IDs (both directions)
    const { data: friendRows, error: friendError } = await supabaseClient
      .from("Friends")
      .select("user_id, friend_id")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (friendError) {
      console.error(`[getFriendFeed] Error fetching friends:`, friendError);
      throw new Error("Failed to fetch friends");
    }

    const friendIds = (friendRows ?? []).map((r: any) =>
      r.user_id === userId ? r.friend_id : r.user_id,
    );

    if (friendIds.length === 0) {
      return { ratings: [], page, pageSize, hasMore: false };
    }

    // Only show activity from the last month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const cutoff = oneMonthAgo.toISOString();

    // Get total count for hasMore
    const { count, error: countError } = await supabaseClient
      .from("Ratings")
      .select("*", { count: "exact", head: true })
      .in("user_id", friendIds)
      .gte("created_at", cutoff);

    if (countError) {
      console.error(`[getFriendFeed] Error counting ratings:`, countError);
      throw new Error("Failed to count friend ratings");
    }

    const totalCount = count ?? 0;

    // Get paginated ratings
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: ratings, error: ratingsError } = await supabaseClient
      .from("Ratings")
      .select("rating_id, user_id, tmdb_id, rating, note, film_name, genre_ids, image_url, like_count, created_at")
      .in("user_id", friendIds)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (ratingsError) {
      console.error(`[getFriendFeed] Error fetching ratings:`, ratingsError);
      throw new Error("Failed to fetch friend ratings");
    }

    // Enrich with has_liked + friend name
    const ratingIds = (ratings ?? []).map((r: any) => r.rating_id);
    const ratingUserIds = [...new Set((ratings ?? []).map((r: any) => r.user_id))];

    const tmdbIds = [...new Set((ratings ?? []).map((r: any) => r.tmdb_id))];

    const [likesResult, namesResult, filmsResult] = await Promise.all([
      ratingIds.length > 0
        ? supabaseClient
            .from("Rating_Likes")
            .select("rating_id")
            .in("rating_id", ratingIds)
            .eq("user_id", userId)
        : Promise.resolve({ data: [], error: null }),
      ratingUserIds.length > 0
        ? supabaseClient
            .from("User_Profiles")
            .select("user_id, name")
            .in("user_id", ratingUserIds)
        : Promise.resolve({ data: [], error: null }),
      tmdbIds.length > 0
        ? supabaseClient
            .from("Guanghai")
            .select("tmdb_id, photo_url")
            .in("tmdb_id", tmdbIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const userLikeSet = new Set((likesResult.data ?? []).map((l: any) => l.rating_id));
    const nameMap = new Map((namesResult.data ?? []).map((u: any) => [u.user_id, u.name]));
    const photoMap = new Map((filmsResult.data ?? []).map((f: any) => [f.tmdb_id, f.photo_url]));

    const enrichedRatings = (ratings ?? []).map((r: any) => ({
      ...r,
      has_liked: userLikeSet.has(r.rating_id),
      user_name: nameMap.get(r.user_id) ?? "Unknown",
      photo_url: photoMap.get(r.tmdb_id) ?? null,
    }));

    const hasMore = from + pageSize < totalCount;

    const signedRatings = await signImageUrls(supabaseClient, enrichedRatings);
    return { ratings: signedRatings, page, pageSize, hasMore };
  } catch (err) {
    console.error(`[getFriendFeed] Exception:`, err);
    throw new Error("Failed to fetch friend feed");
  }
};


type InviteRequest = {
  supabaseClient: SupabaseClient;
  userId: UUID;
};

type RedeemInviteRequest = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  code: string;
};

export const createInvite = async ({ supabaseClient, userId }: InviteRequest) => {
  try {
    const code = randomBytes(6).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseClient
      .from("Friend_Invites")
      .insert({ code, user_id: userId, expires_at: expiresAt });

    if (error) {
      console.error(`[createInvite] Error creating invite for user ${userId}:`, error);
      throw new Error("Failed to create invite");
    }

    return { code, expiresAt };
  } catch (err) {
    console.error(`[createInvite] Exception:`, err);
    throw err;
  }
};

export const redeemInvite = async ({ supabaseClient, userId, code }: RedeemInviteRequest) => {
  try {
    // 1. Look up invite
    const { data: invite, error: inviteError } = await supabaseClient
      .from("Friend_Invites")
      .select("user_id, expires_at")
      .eq("code", code)
      .single();

    if (inviteError || !invite) {
      throw new Error("Invite not found or expired");
    }

    if (new Date(invite.expires_at) < new Date()) {
      throw new Error("Invite not found or expired");
    }

    const inviterId = invite.user_id as UUID;

    // 2. Cannot redeem own invite
    if (inviterId === userId) {
      throw new Error("Cannot redeem your own invite");
    }

    // 3. Check if already friends (either direction)
    const { data: existing } = await supabaseClient
      .from("Friends")
      .select("request_id, status")
      .or(`and(user_id.eq.${inviterId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${inviterId})`)
      .single();

    if (existing) {
      if (existing.status === "accepted") {
        throw new Error("Already friends");
      }

      // 4. Pending request exists — auto-accept it
      const { error: acceptError } = await supabaseClient
        .from("Friends")
        .update({ status: "accepted" })
        .eq("request_id", existing.request_id);

      if (acceptError) {
        throw new Error("Failed to accept pending request");
      }
    } else {
      // 5. No existing relationship — create accepted friendship directly
      const { error: insertError } = await supabaseClient
        .from("Friends")
        .insert({ user_id: inviterId, friend_id: userId, status: "accepted" });

      if (insertError) {
        console.error(`[redeemInvite] Error creating friendship:`, insertError);
        throw new Error("Failed to create friendship");
      }
    }

    // 6. Get inviter's name for the frontend
    const { data: inviter } = await supabaseClient
      .from("User_Profiles")
      .select("name")
      .eq("user_id", inviterId)
      .single();

    return { inviterId, inviterName: inviter?.name ?? "Unknown" };
  } catch (err) {
    console.error(`[redeemInvite] Exception:`, err);
    throw err;
  }
};

export const getActiveInvites = async ({ supabaseClient, userId }: InviteRequest) => {
  try {
    const { data, error } = await supabaseClient
      .from("Friend_Invites")
      .select("code, created_at, expires_at")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`[getActiveInvites] Error fetching invites for user ${userId}:`, error);
      throw new Error("Failed to fetch invites");
    }

    return data;
  } catch (err) {
    console.error(`[getActiveInvites] Exception:`, err);
    throw err;
  }
};

