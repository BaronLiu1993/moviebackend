import { Router } from "express";
import { handleSignIn } from "../../service/auth/authService.js";
import { createSignInSupabase } from "../../service/supabase/configureSupabase.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import { createSupabaseClient } from "../../service/supabase/configureSupabase.js";

const router = Router();

router.post("/signup-with-google", async (req, res) => {
  try {
    const callbackURL = await handleSignIn();
    if (callbackURL) {
      res.redirect(callbackURL);
    }
    return res.status(200).json({ message: "" });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/oauth2callback", async (req, res) => {
  const code = req.body.code;
  const supabase = createSignInSupabase();
  try {
    const { data: tokenData, error: tokenDataError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (tokenDataError || !tokenData?.session) {
      return res
        .status(400)
        .json({ message: "Failed to exchange code for session" });
    }
    const { session } = tokenData;
    const user = session.user;

    const supabaseClient = createSupabaseClient({
      accessToken: session.access_token,
    });

    const { error: userDoesNotExist } = await supabaseClient
      .from("User_Profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    // Case if user does not exist that means they need to be register
    if (userDoesNotExist) {
      const { error: tokenInsertionError } = await supabaseClient
        .from("User_Profiles")
        .insert({
          user_id: user.id,
          student_email: user.email,
          student_name: user.user_metadata?.full_name,
        });

      if (tokenInsertionError) {
        return res.status(400).json({ message: "Failed" });
      }

      return res.status(200).json({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
      // User exists and we need to send just log them in
    } else {
      return res.status(200).json({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
    }
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/register", verifyToken, async (req, res) => {
  const {} = req.body
  try {
    
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router