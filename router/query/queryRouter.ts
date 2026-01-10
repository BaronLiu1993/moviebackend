import { Router } from "express";
import {
  getRelatedFilms,
} from "../../service/query/queryService.js";
import { verifyToken } from "../../middleware/verifyToken.js";

const router = Router();

router.get("/start-search", async (req, res) => {
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

export default router;
