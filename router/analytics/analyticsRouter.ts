import { Router } from "express";
import {
  handleBookmark,
  handleLike,
} from "../../service/analytics/analyticsService.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import {
  bookmarkRequestSchema,
  likeRequestSchema,
  bulkImpressionsRequestSchema,
} from "../../schemas/analyticsSchema.js";
import impressionQueue from "../../queue/impression/addImpressionQueue.js";

const router = Router();

router.post(
  "/bookmark",
  validateZod(bookmarkRequestSchema),
  async (req, res) => {
    const { userId, tmdbId, film_name, genre_ids } = req.body;
    try {
      await handleBookmark({
        userId,
        tmdbId,
        film_name,
        genre_ids,
      });
      return res.status(200).send();
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.post("/like", validateZod(likeRequestSchema), async (req, res) => {
  const { userId, tmdbId, film_name, genre_ids } = req.body;
  try {
    await handleLike({
      userId,
      tmdbId,
      film_name,
      genre_ids,
    });
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post(
  "/bulk-impressions",
  verifyToken,
  validateZod(bulkImpressionsRequestSchema),
  async (req, res) => {
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
      console.log(err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

export default router;
