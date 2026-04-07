import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { deleteRating, insertRating, selectRatings, updateRating } from "../../service/rate/rateService.js";
import { validateInsertRating, validateUpdateRating } from "../../middleware/validateRating.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import { insertRatingRequestSchema, updateRatingRequestSchema, deleteRatingRequestSchema, likeRequestSchema, unlikeRequestSchema } from "../../schemas/rateSchema.js";
import { addLikeFilm, removeLikeFilm } from "../../service/feed/feedService.js";
import { insertInteractionEvents } from "../../service/clickhouse/clickhouseService.js";
import type { UUID } from "node:crypto";

const router = Router();

router.post("/ratings", verifyToken, validateZod(insertRatingRequestSchema), validateInsertRating, async (req, res) => {
  const { tmdbId, rating, note, name, genre_ids } = req.body;
  const userId = req.user?.sub as UUID;
  const accessToken = req.token!;
  const supabaseClient = req.supabaseClient!;
  try {
    await insertRating({ tmdbId, userId, rating, note, name, genre_ids, supabaseClient, accessToken });
    return res.status(201).send();
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

  try {
    await addLikeFilm({ supabaseClient, userId, tmdbId, film_name, genre_ids });
    await insertInteractionEvents({ userId, tmdbId, interactionType: "like", film_name, genre_ids, rating: 0 });
    return res.status(200).json({ message: "Like recorded" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/like", verifyToken, validateZod(unlikeRequestSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const { tmdbId } = req.body;
  const supabaseClient = req.supabaseClient!;
  try {
    await removeLikeFilm({ supabaseClient, userId, tmdbId });
    await insertInteractionEvents({ userId, tmdbId, interactionType: "like", rating: 0 });
    return res.status(200).json({ message: "Like removed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
