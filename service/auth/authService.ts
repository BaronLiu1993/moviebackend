import { createSignInSupabase } from "../supabase/configureSupabase.js";
import OpenAI from "openai";
import dotenv from "dotenv"
import type { UUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

dotenv.config()

const scopes = ["email", "profile"];
const OPENAI_KEY=process.env.OPENAI_API_KEY

interface ProfileRequestType {
  userId: UUID
  supabaseClient: SupabaseClient
}

interface SelectProfileRequestType extends ProfileRequestType {
  friendId: UUID
}

interface ProfileChangeRequestType extends ProfileRequestType {
  inputString: string
}

type FriendRequestType = {
  userId: UUID
  friendId: UUID
  supabaseClient: SupabaseClient
}

type ChangeFriendStatusType = {
  requestId: UUID
  supabaseClient: SupabaseClient
}


const OpenAIClient = new OpenAI({
  apiKey: OPENAI_KEY,
});

const checkIsFriends = async ({supabaseClient, userId, friendId}: SelectProfileRequestType) => {
  const {data, error }  = await supabaseClient.rpc("is_following", {
    p_following_id: friendId,
    p_follower_id: userId
  })
  return data as boolean
}

export const handleSignIn = async (): Promise<string> => {
  const supabase = createSignInSupabase();
  const { data: callbackData, error: callbackError } =
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "",
        scopes: scopes.join(" "),
      },
    });

  if (callbackError || !callbackData) {
    throw new Error("Sign In Callback Error");
  }
  return callbackData.url;
};

// Every User Can Only Generate Once, Check
const checkRegistration = async ({userId, supabaseClient}: ProfileRequestType) => {
  const { data: registrationCheck, error: checkError } = await supabaseClient
    .from("User_Profiles")
    .select("finished_registration")
    .eq("user_id", userId)
    .single()
  if (checkError) {
    throw new Error("Failed to get registration")
  }

  return registrationCheck.finished_registration as boolean
}

export const generateInterestProfileVector = async ({inputString, userId, supabaseClient}: ProfileChangeRequestType) => {
  const check = await checkRegistration({userId, supabaseClient})
  if (check == true) {
    throw new Error("Already Registered")
  }
  const response = await OpenAIClient.embeddings.create({
    model: "text-embedding-3-small",
    input: inputString,
    encoding_format: "float"
  })
  return response.data[0]?.embedding
}

export const sendFriendRequest = async ({userId, friendId, supabaseClient}: FriendRequestType) => {
  const { error: sendError } = await supabaseClient
    .from("Friends")
    .insert({user_id: userId, friend_id: friendId, status: 'pending'})
  if (sendError) {
    throw new Error("Failed to Send Friend Request")
  }
}

export const acceptFriendRequest = async ({requestId, supabaseClient}: ChangeFriendStatusType) => {
  const { error: acceptError } = await supabaseClient
    .from("Friends")
    .update({status: 'accepted'})
    .eq("request_id", requestId)
  if (acceptError) {
    throw new Error("Failed To Accept Friend")
  }
}

export const rejectFriendRequest = async ({requestId, supabaseClient}: ChangeFriendStatusType) => {
  const { error: rejectError } = await supabaseClient
    .from("Friends")
    .delete()
    .eq("request_id", requestId)

  if (rejectError) {
    throw new Error("Failed To Delete/Reject")
  }
}


// I need to return the request Id here
export const getFollowers = async ({}) => {

}

export const getFollowing = async({}) => {

}

export const getProfile = async ({userId, friendId, supabaseClient}: SelectProfileRequestType) => {
  // Check if they are a friend of the user
  const check = await checkIsFriends({supabaseClient, userId, friendId})

  if (check == false) {
    throw new Error("Not Friend or Not Accepted Yet")
  }

  const { data: ratingData, error: ratingDataFetchError} = await supabaseClient
    .from("Ratings")
    .select("film_id, rating, note, film_name")
    .eq("user_id", userId)
  
  if (ratingDataFetchError) {
    throw new Error("Failed to Fetch Rating Data")
  }

  const { data: userMetadata, error: userMetadataFetchError } = await supabaseClient
    .from("User_Profiles")
    .select("genres, movies")
    .eq("user_id", userId)
    .single()
  
  if (userMetadataFetchError) {
    throw new Error("Failed to Fetch Metadata")
  }

  return { ratingData, userMetadata}
}