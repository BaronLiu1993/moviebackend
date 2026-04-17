import { Router } from "express";
import scrapeQueue from "../../queue/scrape/scrapeQueue.js";
import trainingQueue from "../../queue/training/trainingQueue.js";
import { verifyAdminToken } from "../../middleware/verifyAdminToken.js";

const router = Router();

router.post("/scrape", verifyAdminToken, async (_req, res) => {
  try {
    await scrapeQueue.add("scrape-films", {});
    return res.status(202).json({ message: "Scrape job enqueued" });
  } catch (err) {
    console.error("[adminRouter] Failed to enqueue scrape job:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/train", verifyAdminToken, async (_req, res) => {
  try {
    await trainingQueue.add("train-model", {});
    return res.status(202).json({ message: "Training job enqueued" });
  } catch (err) {
    console.error("[adminRouter] Failed to enqueue training job:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
