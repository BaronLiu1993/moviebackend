import { Router } from "express";
import { handleSignIn } from "../../service/auth/authService.js";

const router = Router();

router.post("/signup-with-google", (req, res) => {
  try {
    const callbackURL = handleSignIn({ res });
    if (callbackURL) {
      res.redirect(callbackURL);
    }
    return res.status(200).json({ message: "" });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/oauth2callback/login", (req, res) => {
  const code = req.body.code;
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
  } catch {
    
  }
});
