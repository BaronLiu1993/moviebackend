import { createSignInSupabase } from "../supabase/configureSupabase.js";
import OpenAI from "openai";
import dotenv from "dotenv"
import type { UUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

dotenv.config()

const scopes = ["email", "profile"];
const OPENAI_KEY=process.env.OPENAI_API_KEY

type ProfileChangeType = {
  inputString: string
}

type SelectProfileType = {
  userId: UUID
  friendId: UUID
  supabaseClient: SupabaseClient
}

type FriendRequest


const OpenAIClient = new OpenAI({
  apiKey: OPENAI_KEY,
});

const checkIsFriends = async ({supabaseClient, userId, friendId}: SelectProfileType) => {
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

export const generateInterestProfileVector = async ({inputString}: ProfileChangeType) => {
  const response = await OpenAIClient.embeddings.create({
    model: "text-embedding-3-small",
    input: inputString,
    encoding_format: "float"
  })
  return response.data[0]?.embedding
}

export const sendFriendRequest = async ({userId, friendId, supabaseClient}) => {
  
}

export const acceptFriendRequest = async ({userId, friendId, supabaseClient}) => {

}

export const rejectFriendRequest = async ({userId, friendId, supabaseClient}) => {

}

export const getProfile = async ({userId, friendId, supabaseClient}: SelectProfileType) => {
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