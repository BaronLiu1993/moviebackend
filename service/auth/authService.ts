/**
 * This module handles:
 * - Google OAuth sign-in via Supabase
 * - User profile registration and embedding generation (OpenAI)
 * - Friend requests (send / accept / reject)
 * - Fetching followers and following relationships
 * - Secure profile access between accepted friends
 *
 * It acts as the main service layer between the API routes,
 * Supabase (auth + database), and OpenAI.
 */

import { createSignInSupabase } from "../supabase/configureSupabase.js";
import OpenAI from "openai";
import dotenv from "dotenv";
import type { UUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

dotenv.config();

// config
const SCOPES = ["email", "profile"];
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
  throw new Error("Missing OPENAI_API_KEY");
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// types
interface BaseRequest {
  userId: UUID;
  supabaseClient: SupabaseClient;
}

interface ProfileChangeRequest extends BaseRequest {
  inputString: string;
}

interface FriendRequest extends BaseRequest {
  friendId: UUID;
}

interface FriendStatusChange {
  requestId: UUID;
  supabaseClient: SupabaseClient;
}

// helpers
// Checks whether two users have an accepted friendship relationship
const checkIsFriends = async (
  supabaseClient: SupabaseClient,
  userId: UUID,
  friendId: UUID
): Promise<boolean> => {
  const { data, error } = await supabaseClient.rpc("is_following", {
    p_follower_id: userId,
    p_following_id: friendId,
  });

  if (error) {
    throw new Error("Failed to check friendship status");
  }

  return Boolean(data);
};

// Ensures a user can only complete profile registration once
const checkRegistration = async (
  supabaseClient: SupabaseClient,
  userId: UUID
): Promise<boolean> => {
  const { data, error } = await supabaseClient
    .from("User_Profiles")
    .select("finished_registration")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Failed to check registration status");
  }

  return data.finished_registration;
};

// auth
// Initiates Google OAuth sign-in and returns the redirect URL
export const handleSignIn = async (): Promise<string> => {
  const supabase = createSignInSupabase();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: SCOPES.join(" "),
      redirectTo: "",
    },
  });

  if (error || !data?.url) {
    throw new Error("Google OAuth sign-in failed");
  }

  return data.url;
};

// profile
// Generates an OpenAI embedding for a user's interest profile (one-time only)
export const generateInterestProfileVector = async ({
  inputString,
  userId,
  supabaseClient,
}: ProfileChangeRequest): Promise<number[]> => {
  const isRegistered = await checkRegistration(supabaseClient, userId);

  if (isRegistered) {
    throw new Error("User has already completed registration");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: inputString,
    encoding_format: "float",
  });

  if (!response.data[0]?.embedding) {
    throw new Error("Failed to generate embedding");
  }

  return response.data[0].embedding;
};

// friends
// Sends a friend request with a pending status
export const sendFriendRequest = async ({
  userId,
  friendId,
  supabaseClient,
}: FriendRequest): Promise<void> => {
  const { error } = await supabaseClient
    .from("Friends")
    .insert({
      user_id: userId,
      friend_id: friendId,
      status: "pending",
    });

  if (error) {
    throw new Error("Failed to send friend request");
  }
};

// Accepts a pending friend request
export const acceptFriendRequest = async ({
  requestId,
  supabaseClient,
}: FriendStatusChange): Promise<void> => {
  const { error } = await supabaseClient
    .from("Friends")
    .update({ status: "accepted" })
    .eq("request_id", requestId);

  if (error) {
    throw new Error("Failed to accept friend request");
  }
};

// Rejects (deletes) a pending friend request
export const rejectFriendRequest = async ({
  requestId,
  supabaseClient,
}: FriendStatusChange): Promise<void> => {
  const { error } = await supabaseClient
    .from("Friends")
    .delete()
    .eq("request_id", requestId);

  if (error) {
    throw new Error("Failed to reject friend request");
  }
};

// followers / following
// Returns incoming pending friend requests (followers)
export const getFollowers = async ({
  userId,
  supabaseClient,
  page = 1,
  pageSize = 10,
}: BaseRequest & {
  page?: number;
  pageSize?: number;
}) => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabaseClient
    .from("Friends")
    .select("request_id, user_id, status")
    .eq("friend_id", userId)
    .eq("status", "pending")
    .range(from, to);

  if (error) {
    throw new Error("Failed to fetch followers");
  }

  return data;
};


// Returns outgoing friend requests and accepted friendships
export const getFollowing = async ({
  userId,
  supabaseClient,
  page = 1,
  pageSize = 10,
}: BaseRequest & {
  page?: number;
  pageSize?: number;
}) => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabaseClient
    .from("Friends")
    .select("request_id, friend_id, status")
    .eq("user_id", userId)
    .range(from, to);

  if (error) {
    throw new Error("Failed to fetch following");
  }

  return data;
};

// profile view
// Fetches a friend's profile and ratings if the friendship is accepted
export const getProfile = async ({
  userId,
  friendId,
  supabaseClient,
}: FriendRequest) => {
  const isFriend = await checkIsFriends(
    supabaseClient,
    userId,
    friendId
  );

  if (!isFriend) {
    throw new Error("Users are not friends");
  }

  const { data: ratings, error: ratingsError } =
    await supabaseClient
      .from("Ratings")
      .select("film_id, rating, note, film_name")
      .eq("user_id", friendId);

  if (ratingsError) {
    throw new Error("Failed to fetch ratings");
  }

  const { data: profile, error: profileError } =
    await supabaseClient
      .from("User_Profiles")
      .select("genres, movies")
      .eq("user_id", friendId)
      .single();

  if (profileError || !profile) {
    throw new Error("Failed to fetch user profile");
  }

  return {
    ratings,
    profile,
  };
};