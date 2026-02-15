import { Router } from "express";
import {
  handleClick,
  handleImpression,
  handleLike,
} from "../../service/analytics/analyticsService.js";

const router = Router();

router.post("/click", async (req, res) => {
  const { userId, filmId, name, genre } = req.body;

  if (!userId || !filmId || !name || !genre) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    await handleClick({
      userId,
      filmId,
      name,
      genre,
    });
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/impression", async (req, res) => {
  const { userId, filmId, name, genre } = req.body;

  if (!userId || !filmId || !name || !genre) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  try {
    await handleImpression({
      userId,
      filmId,
      name,
      genre,
    });
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/like", async (req, res) => {
  const { userId, filmId, name, genre } = req.body;

  if (!userId || !filmId || !name || !genre) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  try {
    await handleLike({
      userId,
      filmId,
      name,
      genre,
    });
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/friend-like", async (req, res) => {
  const { userId, friendId, filmId, name, genre } = req.body;

  if (!userId || !friendId || !filmId || !name || !genre) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  try {
    await handleLike({
      userId,
      filmId,
      name,
      genre,
    });
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
