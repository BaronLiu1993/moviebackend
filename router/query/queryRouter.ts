import { Router } from "express";
import {
  getInitialFeed,
  getFriendFilms,
  getAiringDramas,
  getPopularDramas
} from "../../service/feed/feedService.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import type { UUID } from "node:crypto";
import { selectRatings } from "../../service/rate/rateService.js";

const router = Router();

// Users get movies they rated 
router.get("/ratings", verifyToken, async (req, res) => {
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;
  
  if (!supabaseClient || !userId) {
    return res.status(401).json({ message: "Missing Supabase or UserID" });
  }
  try {
    const data = await selectRatings({ supabaseClient, userId });
    return res.status(200).json({ data });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Generate personalized feed for users based on their embeddings and interactions
router.get("/initial-feed", verifyToken, async (req, res) => {
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;
  
  if (!supabaseClient || !userId) {
    return res.status(401).json({ message: "Missing Supabase or UserID" });
  }
  try {
    const response = await getInitialFeed({ supabaseClient, userId });
    return res.status(200).json({ data: response });
  } catch (err){
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});



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

// TEST ENDPOINTS DO NOT USE IN PRODUCTION
router.get("/airing", async (req, res) => {
  try {
    const data = await getAiringDramas();
    return res.status(200).json({ data });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/popular", async (req, res) => {
  try {
    const data = await getPopularDramas();
    return res.status(200).json({ data });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
