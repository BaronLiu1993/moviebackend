import { Router } from "express";
import {
  getInitialFeed,
} from "../../service/feed/feedService.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import type { UUID } from "node:crypto";
import { selectRatings } from "../../service/rate/rateService.js";
import { getFeedQuerySchema } from "../../schemas/feedSchema.js";

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
// Supports pagination for infinite scrolling: ?page=1&pageSize=20
router.get("/generate-feed", verifyToken, async (req, res) => {
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!supabaseClient || !userId) {
    return res.status(401).json({ message: "Missing Supabase or UserID" });
  }

  const parsed = getFeedQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  const { page, pageSize } = parsed.data;
  console.log(page, pageSize)

  try {
    const response = await getInitialFeed({ supabaseClient, userId, page, pageSize });
    return res.status(200).json(response);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
