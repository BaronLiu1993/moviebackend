import { Router } from "express";
import {
  getRelatedFilms,
  getRecommendedFilms,
  getFriendFilms,
  getSimilarFilms,
} from "../../service/query/queryService.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import type { UUID } from "node:crypto";

const router = Router();

// Begin Search By Taking Friend's Bookmarked Films (Friend's Film)
router.get("/friend-search", verifyToken, async (req, res) => {
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!supabaseClient || !userId) {
    return res.status(401).json({ message: "Missing Supabase or UserID" });
  }
  try {
    const data = await getFriendFilms({ supabaseClient, userId });
    return res.status(200).json({ data });
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Similarity Search using Text (Embeddings + Film Embeddings)
router.get("/similarity-search", async (req, res) => {
  const { query } = req.query;
  const supabaseClient = req.supabaseClient;

  if (!query || typeof query !== "string" || !supabaseClient) {
    return res
      .status(400)
      .json({ message: "Missing or Invalid Query Parameter" });
  }

  try {
    const data = await getSimilarFilms({ query, supabaseClient });
    return res.status(200).json({ data });
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Keyword Search using Genres and Countries
router.get("/keyword-search", async (req, res) => {
  const { genres, countries } = req.query;
  if (!genres || !countries) {
    return res.status(400).json({ message: "Missing Parameters" });
  }

  if (typeof genres !== "string" || typeof countries !== "string") {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  try {
    const data = await getRelatedFilms({ genres, countries });
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Begin Search for User Recommended Films (Film Embedding + User Embedding)
router.get("/user-recommended-search", async (req, res) => {
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!supabaseClient || !userId) {
    return res.status(401).json({ message: "Missing Supabase or UserID" });
  }
  try {
    const data = await getRecommendedFilms({ supabaseClient, userId });
    return res.status(200).json({ data });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
