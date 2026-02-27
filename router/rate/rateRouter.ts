import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { deleteRating, insertRating, selectRatings, updateRating } from "../../service/rate/rateService.js";
import { validateInsertRating, validateUpdateRating } from "../../middleware/validateRating.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import { insertRatingRequestSchema, updateRatingRequestSchema, deleteRatingRequestSchema } from "../../schemas/rateSchema.js";
import type { UUID } from "node:crypto";

const router = Router();

router.post("/insert-ratings", verifyToken, validateZod(insertRatingRequestSchema), validateInsertRating, async (req, res) => {
  const { tmdbId, rating, note, name, genre_ids } = req.body;
  console.log("Received insert rating request:", { tmdbId, rating, note, name, genre_ids });
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

router.get("/select-ratings", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  console.log("test")
  if (!userId || !req.supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  const supabaseClient = req.supabaseClient;

  try {
    const ratings = await selectRatings({ userId, supabaseClient });
    return res.status(200).json({ data: ratings });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/delete-ratings", verifyToken, validateZod(deleteRatingRequestSchema), async (req, res) => {
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

router.put("/update-ratings", verifyToken, validateZod(updateRatingRequestSchema), validateUpdateRating, async (req, res) => {
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

export default router;
