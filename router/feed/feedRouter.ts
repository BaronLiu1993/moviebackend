import { Router } from "express";
import {
  getInitialFeed,
} from "../../service/feed/feedService.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import type { UUID } from "node:crypto";
import { selectRatings } from "../../service/rate/rateService.js";
import { getFeedQuerySchema } from "../../schemas/feedSchema.js";
import { handleLike } from "../../service/analytics/analyticsService.js";
import { likeRequestSchema, bulkImpressionsRequestSchema } from "../../schemas/analyticsSchema.js";
import impressionQueue from "../../queue/impression/addImpressionQueue.js";

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

router.post("/like", verifyToken, validateZod(likeRequestSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const { tmdbId, film_name, genre_ids } = req.body;

  if (!userId) {
    return res.status(401).json({ message: "Missing UserID" });
  }

  try {
    await handleLike({ userId, tmdbId, film_name, genre_ids });
    return res.status(200).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Add all impressions into clickhouse in bulk, we will process them asynchronously for analytics and feed ranking
router.post("/bulk-impressions", verifyToken, validateZod(bulkImpressionsRequestSchema), async (req, res) => {
  const { impressions } = req.body;

  try {
    await impressionQueue.addBulk(
      impressions.map((imp: any) => ({
        name: "impression-sync",
        data: imp,
      })),
    );
    return res.status(200).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
