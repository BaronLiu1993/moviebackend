import { Router } from "express";
import {
  handleBookmark,
  handleLike,
  handleImpression,
} from "../../service/analytics/analyticsService.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import { bookmarkRequestSchema, likeRequestSchema, bulkImpressionsRequestSchema } from "../../schemas/analyticsSchema.js";

const router = Router();

router.post("/bookmark", validateZod(bookmarkRequestSchema), async (req, res) => {
  const { userId, tmdbId, name } = req.body;
  try {
    await handleBookmark({
      userId,
      tmdbId,
      name,
    });
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/like", validateZod(likeRequestSchema), async (req, res) => {
  const { userId, tmdbId, name } = req.body;
  try {
    await handleLike({
      userId,
      tmdbId,
      name,
    });
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/bulk-impressions", verifyToken, validateZod(bulkImpressionsRequestSchema), async(req, res) => {
    const { impressions } = req.body;

    try {
        await handleImpression(impressions);
        return res.status(200).send();
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
})

export default router;
