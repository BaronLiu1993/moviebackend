import { createSignInSupabase } from "../supabase/configureSupabase.js";

const scopes = ["email", "profile"];

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
