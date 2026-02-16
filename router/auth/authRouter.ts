import { Router } from "express";
import {
  handleSignIn,
  registerUser,
} from "../../service/auth/authService.js";
import { createSignInSupabase } from "../../service/supabase/configureSupabase.js";
import { createSupabaseClient } from "../../service/supabase/configureSupabase.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import type { UUID } from "node:crypto";

const router = Router();

router.get("/signup-with-google", async (req, res) => {
  try {
    const callbackURL = await handleSignIn();
    if (callbackURL) {
      res.redirect(callbackURL);
    }
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// abstract business logic into service layer then call it here (refactor this later)
router.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  console.log(code)
  const supabase = createSignInSupabase();

  if (!code || typeof code !== "string") {
    return res.status(400).json({ message: "Missing or Invalid Code" });
  }

  try {
    const { data: tokenData, error: tokenDataError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (tokenDataError || !tokenData?.session) {
      console.log(tokenDataError);
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

    if (userDoesNotExist) {
      const { error: tokenInsertionError } = await supabaseClient
        .from("User_Profiles")
        .insert({
          user_id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name,
        });

      if (tokenInsertionError) {
        return res.status(400).json({ message: "Failed" });
      }

      return res.status(200).json({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
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
  const { genres, movies, moods, dislikedGenres, movieIds } = req.body;
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!supabaseClient || !userId || !genres) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    await registerUser({ userId, genres, movies, moods, dislikedGenres, movieIds, supabaseClient });
    return res.status(204).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
