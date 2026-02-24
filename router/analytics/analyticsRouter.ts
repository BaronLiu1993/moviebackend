import { Router } from "express";
import {
  handleBookmark,
  handleLike,
  handleImpression,
} from "../../service/analytics/analyticsService.js";
import { verifyToken } from "../../middleware/verifyToken.js";

const router = Router();

router.post("/bookmark", async (req, res) => {
  const { userId, tmdbId, name } = req.body;
  if (!userId || !tmdbId || !name) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
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

router.post("/like", async (req, res) => {
  const { userId, tmdbId, name } = req.body;

  if (!userId || !tmdbId || !name) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
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

router.post("/bulk-impressions", verifyToken, async(req, res) => {
    const { impressions } = req.body;
    if (!impressions || !Array.isArray(impressions) || impressions.length === 0) {
        return res.status(400).json({ message: "Missing or Invalid Impressions" });
    } // Validate the structure of each impression before insertions

    try {
        await handleImpression(impressions);
        return res.status(200).send();
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
})

export default router;
