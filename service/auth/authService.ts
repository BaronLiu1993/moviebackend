import { createSupabase } from "../supabase/configureSupabase.js";

const scopes = ["email", "profile"];

export const handleSignIn = async ({ res }) => {
  try {
    const supabase = createSupabase();
    const { data: callbackData, error: callbackError } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "",
          scopes: scopes.join(" "),
        },
      });

    if (callbackError || !callbackData) {
      return res.status(400).json({ message: "Failed to Authorized" });
    }

    return callbackData.url;
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
