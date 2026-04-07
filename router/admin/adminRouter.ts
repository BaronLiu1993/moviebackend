import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import scrapeQueue from "../../queue/scrape/scrapeQueue.js";

const router = Router();

router.post("/scrape", verifyToken, async (_req, res) => {
  try {
    await scrapeQueue.add("scrape-films", {});
    return res.status(202).json({ message: "Scrape job enqueued" });
  } catch (err) {
    console.error("[adminRouter] Failed to enqueue scrape job:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
