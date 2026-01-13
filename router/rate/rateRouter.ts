import { Router } from "express";
import { deleteRating, insertRating, selectRatings } from "../../service/rate/rateService.js";
import type { UUID } from "node:crypto";

const router = Router();

router.post("/insert", async (req, res) => {
  const { filmId, rating, note } = req.body
  const userId = req.user?.sub as UUID

  if (!filmId || !userId || !rating || !note || !req.supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs"})
  }
  const supabaseClient = req.supabaseClient;
  
  try {
    await insertRating({filmId, userId, rating, note, supabaseClient})
    return res.status(200).json({message: "Inserted Successfully"})
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/select", async (req, res) => {
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

router.delete("/delete", async (req, res) => {
  const userId = req.user?.sub as UUID
  const { ratingId } = req.body

  if (!userId || !ratingId || !req.supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs"})
  }
  const supabaseClient = req.supabaseClient;
  try {
    await deleteRating({ratingId, supabaseClient})
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/update", async (req, res) => {
  const userId = req.user?.sub as UUID
  try {

  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


export default router;
