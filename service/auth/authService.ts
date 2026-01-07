import { createSignInSupabase } from "../supabase/configureSupabase.js";
import OpenAI from "openai";
import dotenv from "dotenv"

dotenv.config()

const scopes = ["email", "profile"];
const OPENAI_KEY=process.env.OPENAI_API_KEY

type ProfileChangeType = {
  inputString: string
}

const OpenAIClient = new OpenAI({
  apiKey: OPENAI_KEY,
});

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
