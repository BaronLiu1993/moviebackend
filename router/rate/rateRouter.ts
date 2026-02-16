import { Router } from "express";
import { deleteRating, insertRating, selectRatings, updateRating } from "../../service/rate/rateService.js";
import type { UUID } from "node:crypto";

const router = Router();

router.post("/insert-ratings", async (req, res) => {
  const { filmId, rating, note, name, genre } = req.body
  const userId = req.user?.sub as UUID
  const accessToken = req.token
  
  if (!filmId || !userId || !rating || !req.supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs"})
  }
  
  const supabaseClient = req.supabaseClient;
  
  try {
    if (!accessToken) {
      return res.status(401).json({ message: "Missing Access Token" });
    }
    await insertRating({filmId, userId, rating, note: note || "", name: name, genre: genre, supabaseClient, accessToken})
    return res.status(201).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/select-ratings", async (req, res) => {
  const userId = req.user?.sub as UUID
  if (!userId || !req.supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs"})
  }
  const supabaseClient = req.supabaseClient;

  try {
    const ratings = await selectRatings({userId, supabaseClient})
    return res.status(200).json({data: ratings})
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
}); 

router.delete("/delete-ratings", async (req, res) => {
  const userId = req.user?.sub as UUID
  const { ratingId } = req.body

  if (!userId || !ratingId || !req.supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs"})
  }
  const supabaseClient = req.supabaseClient;
  const accessToken = req.token;
  try {
    if (!accessToken) {
      return res.status(401).json({ message: "Missing Access Token" });
    }
    await deleteRating({ratingId, userId, supabaseClient, accessToken});
    return res.status(204).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/update-ratings", async (req, res) => {
  const userId = req.user?.sub as UUID
  const { ratingId, newRating } = req.body;

  if (!userId || !ratingId || newRating === undefined || !req.supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs"})
  }
  
  const supabaseClient = req.supabaseClient;
  const accessToken = req.token;

  try {
    if (!accessToken) {
      return res.status(401).json({ message: "Missing Access Token" });
    }
    await updateRating({ratingId, userId, newRating, supabaseClient, accessToken});
    return res.status(204).send();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


export default router;
