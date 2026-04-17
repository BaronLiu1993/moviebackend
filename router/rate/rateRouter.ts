import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { deleteRating, insertRating, selectRatings, updateRating } from "../../service/rate/rateService.js";
import { validateInsertRating, validateUpdateRating } from "../../middleware/validateRating.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import { insertRatingRequestSchema, updateRatingRequestSchema, deleteRatingRequestSchema, likeRequestSchema, unlikeRequestSchema, likeRatingRequestSchema, unlikeRatingRequestSchema } from "../../schemas/rateSchema.js";
import { likeFilm, unlikeFilm } from "../../service/feed/feedService.js";
import { likeRating, unlikeRating } from "../../service/rate/rateService.js";
import type { UUID } from "node:crypto";

const router = Router();

router.post("/ratings", verifyToken, validateZod(insertRatingRequestSchema), validateInsertRating, async (req, res) => {
  const { tmdbId, rating, note, name, genre_ids, hasImage } = req.body;
  const userId = req.user?.sub as UUID;
  const accessToken = req.token!;
  const supabaseClient = req.supabaseClient!;
  try {
    const result = await insertRating({ tmdbId, userId, rating, note, name, genre_ids, supabaseClient, accessToken, hasImage });
    return res.status(201).json({ data: result });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/ratings", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient;

  if (!userId || !supabaseClient) {
    return res.status(401).json({ message: "Missing Supabase or UserID" });
  }

  try {
    const ratings = await selectRatings({ userId, supabaseClient });
    return res.status(200).json({ data: ratings });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/ratings", verifyToken, validateZod(deleteRatingRequestSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const { ratingId } = req.body;
  const supabaseClient = req.supabaseClient!;
  const accessToken = req.token!;
  try {
    await deleteRating({ ratingId, userId, supabaseClient, accessToken });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/ratings", verifyToken, validateZod(updateRatingRequestSchema), validateUpdateRating, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const { ratingId, newRating, newNote } = req.body;
  const supabaseClient = req.supabaseClient!;
  const accessToken = req.token!;

  try {
    await updateRating({ ratingId, userId, newRating, supabaseClient, accessToken, newNote });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/like", verifyToken, validateZod(likeRequestSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const { tmdbId, film_name, genre_ids } = req.body;
  const supabaseClient = req.supabaseClient!;
  const accessToken = req.token!;
  console.log("hit")
  try {
    await likeFilm({ supabaseClient, userId, tmdbId, film_name, genre_ids, accessToken });
    return res.status(201).send();
  } catch (err) {
    if (err instanceof Error && err.message === "Already liked this film") {
      return res.status(409).json({ message: err.message });
    }
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/like", verifyToken, validateZod(unlikeRequestSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const { tmdbId } = req.body;
  const supabaseClient = req.supabaseClient!;
  const accessToken = req.token!;
  console.log("hit delete")
  try {
    await unlikeFilm({ supabaseClient, userId, tmdbId, accessToken });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/like-rating", verifyToken, validateZod(likeRatingRequestSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const { ratingId } = req.body;
  const supabaseClient = req.supabaseClient!;

  try {
    await likeRating({ supabaseClient, userId, ratingId, accessToken: req.token! });
    return res.status(201).send();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Rating not found") return res.status(404).json({ message: err.message });
      if (err.message === "Cannot like your own rating") return res.status(403).json({ message: err.message });
      if (err.message === "Users are not friends") return res.status(403).json({ message: err.message });
      if (err.message === "Already liked this rating") return res.status(409).json({ message: err.message });
    }
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/like-rating", verifyToken, validateZod(unlikeRatingRequestSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const { ratingId } = req.body;
  const supabaseClient = req.supabaseClient!;

  try {
    await unlikeRating({ supabaseClient, userId, ratingId, accessToken: req.token! });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
