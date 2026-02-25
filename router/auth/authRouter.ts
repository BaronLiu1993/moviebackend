import { Router } from "express";
import {
  registerUser,
  signUpUser,
  loginUser,
} from "../../service/auth/authService.js";

import { createSignInSupabase, createSupabaseClient } from "../../service/supabase/configureSupabase.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import type { UUID } from "node:crypto";
import { registerRequestSchema } from "../../schemas/authSchema.js";
import { validateZod } from "../../middleware/schemaValidation.js";


const router = Router();

router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Missing email or password" });
  }
  try {
    const result = await signUpUser({ email, password, name });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ message: err.message || "Signup failed" });
  }
});

// Login with email/password — returns access token
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Missing email or password" });
  }
  try {
    const result = await loginUser({ email, password });
    return res.status(200).json(result);
  } catch (err: any) {
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
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
