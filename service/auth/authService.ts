import type { SupabaseClient } from "@supabase/supabase-js";
import { createSignInSupabase, createSupabaseClient } from "../supabase/configureSupabase.js";
import OpenAI from "openai";

const scopes = ["email", "profile"];

type ProfileChangeType = {
  inputString: string
}

const openAIClient = new OpenAI()

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
  const response = await openAIClient.embeddings.create({
    model: "text-embedding-3-small",
    input: inputString,
    encoding_format: "float"
  })
  return response.data[0]?.embedding
}
