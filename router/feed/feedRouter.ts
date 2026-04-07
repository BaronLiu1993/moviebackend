import { Router } from "express";
import { getInitialFeed } from "../../service/feed/feedService.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import type { UUID } from "node:crypto";
import { getFeedQuerySchema } from "../../schemas/feedSchema.js";
import { searchQuerySchema } from "../../schemas/searchSchema.js";
import { bulkImpressionsRequestSchema } from "../../schemas/analyticsSchema.js";
import impressionQueue from "../../queue/impression/addImpressionQueue.js";
import { searchFilms } from "../../service/search/searchService.js";

const router = Router();

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

  try {
    const response = await getInitialFeed({ supabaseClient, userId, page, pageSize });
    return res.status(200).json(response);
  } catch (err) {
    console.log(err);
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
    return res.status(200).json({ message: "Bulk impressions recorded" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/search", verifyToken, async (req, res) => {
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!supabaseClient || !userId) {
    return res.status(401).json({ message: "Missing Supabase or UserID" });
  }

  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  const { q, page, pageSize, media_type, country, release_year, genre_ids } = parsed.data;

  try {
    const response = await searchFilms({
      supabaseClient,
      query: q,
      page,
      pageSize,
      mediaType: media_type,
      country,
      releaseYear: release_year,
      genreIds: genre_ids,
    });
    return res.status(200).json(response);
  } catch (err) {
    console.error("[search]", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
