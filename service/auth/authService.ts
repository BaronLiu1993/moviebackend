import { createSignInSupabase, createSupabaseClient } from "../supabase/configureSupabase.js";

const scopes = ["email", "profile"];

type ProfileChangeType = {
  accessToken: string
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

export const generateInterestProfile = async ({accessToken}: ProfileChangeType): string => {
  const supabase = createSupabaseClient({accessToken});
  
  
}
