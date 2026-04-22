import { Router } from "express";
import {
  registerUser,
  signUpUser,
  loginUser,
} from "../../service/auth/authService.js";

import { verifyToken } from "../../middleware/verifyToken.js";
import type { UUID } from "node:crypto";
import { registerRequestSchema, signupRequestSchema, loginRequestSchema } from "../../schemas/authSchema.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import log from "../../lib/logger.js";

const router = Router();

router.post("/signup", validateZod(signupRequestSchema), async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const result = await signUpUser({ email, password, name });
    return res.status(200).json(result);
  } catch (err: any) {
    log.warn({ email }, "Signup failed");
    return res.status(400).json({ message: err.message || "Signup failed" });
  }
});

router.post("/login", validateZod(loginRequestSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await loginUser({ email, password });
    log.info({ email }, "User logged in");
    return res.status(200).json(result);
  } catch (err: any) {
    log.warn({ email }, "Login failed");
    return res.status(401).json({ message: err.message || "Login failed" });
  }
});


router.put("/register", verifyToken, validateZod(registerRequestSchema), async (req, res) => {
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
    log.error({ err, userId }, "Registration failed");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/me", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;

  try {
    const { data, error } = await supabaseClient
      .from("User_Profiles")
      .select("user_id, email, name, genres, movies, moods, disliked_genres, completed_registration, rating_count")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ data });
  } catch (err) {
    log.error({ err, userId }, "Failed to fetch user profile");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
