import { Router } from "express";
import {
  handleRating,
  handleBookmark,
  handleLike,
} from "../../service/analytics/analyticsService.js";

const router = Router();

router.post("/rating", async (req, res) => {
  const { userId, tmdbId, name, genre_ids, rating } = req.body;
  if (!userId || !tmdbId || !name || !genre_ids || !rating) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    await handleRating({
      userId,
      tmdbId,
      name,
      genre_ids,
      rating,
    });
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/bookmark", async (req, res) => {
  const { userId, tmdbId, name, genre_ids } = req.body;
  if (!userId || !tmdbId || !name || !genre_ids) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  try {
    await handleBookmark({
      userId,
      tmdbId,
      name,
      genre_ids,
    });

    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/like", async (req, res) => {
  const { userId, tmdbId, name, genre_ids } = req.body;

  if (!userId || !tmdbId || !name || !genre_ids) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  try {
    await handleLike({
      userId,
      tmdbId,
      name,
      genre_ids,
    });
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/friend-like", async (req, res) => {
  const { userId, friendId, tmdbId, name, genre_ids } = req.body;

  if (!userId || !friendId || !tmdbId || !name || !genre_ids) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  try {
    await handleLike({
      userId,
      tmdbId,
      name,
      genre_ids,
    });
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
