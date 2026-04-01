import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "node:crypto";

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

type EnhanceProfileRequest = {
  supabaseClient: SupabaseClient;
  userId: UUID;
  friendId: UUID;
  tmdbId: number;
};

// Checks whether two users have an accepted friendship relationship
const checkIsFriends = async (
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
      throw new Error("Cannot send friend request to yourself");
    }

    // Check if friendId user exists
    const { data: friendExists, error: friendCheckError } = await supabaseClient
      .from("User_Profiles")
      .select("user_id")
      .eq("user_id", friendId)
      .single();

    if (friendCheckError || !friendExists) {
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
    throw err;
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
    throw err;
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
    throw err;
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
    throw err;
  }
};

export const getFriendRequests = async ({
  userId,
  supabaseClient,
}: GetFollowersRequest) => {
  try {
    const { data, error } = await supabaseClient
      .from("Friends")
      .select("request_id, user_id, status, friend_id")
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (error) {
      console.error(`[getFriendRequests] Error fetching requests for user ${userId}:`, error);
      throw new Error(`Failed to fetch friend requests: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error(`[getFriendRequests] Exception:`, err);
    throw err;
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
      .range(from, to);

    if (error) {
      console.error(`[getFollowing] Error fetching following for user ${userId}:`, error);
      throw new Error(`Failed to fetch following: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error(`[getFollowing] Exception:`, err);
    throw err;
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

    const { data: ratings, error: ratingsError } = await supabaseClient
      .from("Ratings")
      .select("film_id, rating, note, film_name")
      .eq("user_id", friendId);

    if (ratingsError) {
      console.error(`[getProfile] Error fetching ratings for friend ${friendId}:`, ratingsError);
      throw new Error(`Failed to fetch ratings: ${ratingsError.message}`);
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("User_Profiles")
      .select("genre, movie")
      .eq("user_id", friendId)
      .single();

    if (profileError || !profile) {
      console.error(`[getProfile] Error fetching profile for friend ${friendId}:`, profileError);
      throw new Error(`Failed to fetch user profile: ${profileError?.message}`);
    }

    return {
      ratings,
      profile,
    };
  } catch (err) {
    console.error(`[getProfile] Exception:`, err);
    throw err;
  }
};

