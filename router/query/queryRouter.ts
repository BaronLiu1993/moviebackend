import { Router } from "express";
import {
  getRelatedFilms,
} from "../../service/query/queryService.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import type { UUID } from "node:crypto";

const router = Router();

router.get("/begin-search", async (req, res) => {
  const { genres, countries } = req.query;

  if (!genres || !countries) {
    return res.status(400).json({ message: "Missing Parameters" });
  }

  if (typeof genres !== "string" || typeof countries !== "string") {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  try {
    const data = await getRelatedFilms({ genres, countries });
    return res.status(200).json({ data });
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/personalised", async (req, res) => {
  const supabase = req.supabaseClient 
  const userId = req.user?.sub as UUID

  if (!supabase || !userId) {
    return res.status(401).json({message: "Missing Supabase or UserID"})
  }

  try {
     const { data: personalisedRecommendations, error: recommendationsError} = await supabase
      .rpc("", {
        
      })
  } catch {
    return res.status(500).json({message: "Internal Server Error"})
  }

 
})

export default router;
