import { Router } from "express";
import { generateFilmEmbedding } from "../../service/rate/rateService.js";

const router = Router();

router.post("/insert", async (req, res) => {
  try {
    const response = await generateFilmEmbedding({filmId: 11})
    
    return res.status(200).json({message: "Inserted Successfully"})
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
