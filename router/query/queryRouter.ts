import { Router } from "express";
import {
  getRecommendedFilms,
  getFriendFilms,
  getCurrentlyAiringDramas,
  getPopularDramas
} from "../../service/query/queryService.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import type { UUID } from "node:crypto";
import { createServerSideSupabaseClient } from "../../service/supabase/configureSupabase.js";

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

// Begin Search for User Recommended Films (Film Embedding + User Embedding)
router.get("/recommendations", async (req, res) => {
  //const supabaseClient = req.supabaseClient;
  //const userId = req.user?.sub as UUID;
  const supabaseClient = createServerSideSupabaseClient();
  const userId = req.query.userId as UUID;
  const limit = 20;
  const offset = parseInt(req.query.offset as string) || 0;
  
  if (!supabaseClient || !userId) {
    return res.status(401).json({ message: "Missing Supabase or UserID" });
  }
  try {
    const data = await getRecommendedFilms({ supabaseClient, userId, limit, offset });
    return res.status(200).json({ data });
  } catch (err){
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/currently-airing", async (req, res) => {
  try {
    const data = await getCurrentlyAiringDramas();
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
