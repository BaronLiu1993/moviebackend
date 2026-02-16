import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { deleteRating, insertRating, selectRatings, updateRating } from "../../service/rate/rateService.js";
import { validateInsertRating, validateUpdateRating } from "../../middleware/validateRating.js";
import type { UUID } from "node:crypto";

const router = Router();

router.post("/insert-ratings", verifyToken, validateInsertRating, async (req, res) => {
  const { filmId, rating, note, name, genre } = req.body;
  const userId = req.user?.sub as UUID;
  const accessToken = req.token!;
  const supabaseClient = req.supabaseClient!;

  try {
    await insertRating({ filmId, userId, rating, note, name, genre, supabaseClient, accessToken });
    return res.status(201).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/select-ratings", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
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

router.delete("/delete-ratings", async (req, res) => {
  const userId = req.user?.sub as UUID;
  const { ratingId } = req.body;

  if (!userId || !ratingId || !req.supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  const supabaseClient = req.supabaseClient;
  const accessToken = req.token;
  try {
    if (!accessToken) {
      return res.status(401).json({ message: "Missing Access Token" });
    }
    await deleteRating({ ratingId, userId, supabaseClient, accessToken });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/update-ratings", validateUpdateRating, async (req, res) => {
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
