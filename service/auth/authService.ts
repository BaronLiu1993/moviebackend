/**
 * It acts as the authentication service layer between the API routes,
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
interface ProfileChangeRequest {
  userId: UUID;
  inputString: string;
  supabaseClient: SupabaseClient;
}

// helpers
// Ensures a user can only complete profile registration once
const checkRegistration = async (
  supabaseClient: SupabaseClient,
  userId: UUID
): Promise<boolean> => {
  try {
    const { data, error } = await supabaseClient
      .from("User_Profiles")
      .select("completed_registration")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      throw new Error("Failed to check registration status");
    }

    return data.completed_registration;
  } catch (err) {
    throw err;
  }
};

// auth
// Initiates Google OAuth sign-in and returns the redirect URL
export const handleSignIn = async (): Promise<string> => {
  try {
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
  } catch (err) {
    throw err;
  }
};

// profile
// Generates an OpenAI embedding for a user's interest profile (one-time only)
export const generateInterestProfileVector = async ({
  inputString,
  userId,
  supabaseClient,
}: ProfileChangeRequest): Promise<number[]> => {
  try {
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
  } catch (err) {
    throw err;
  }
};