import { Router } from "express";
import scrapeQueue from "../../queue/scrape/scrapeQueue.js";
import trainingQueue from "../../queue/training/trainingQueue.js";
import { verifyAdminToken } from "../../middleware/verifyAdminToken.js";
import log from "../../lib/logger.js";

const router = Router();

router.post("/scrape", verifyAdminToken, async (_req, res) => {
  try {
    await scrapeQueue.add("scrape-films", {
      
    });
    return res.status(202).json({ message: "Scrape job enqueued" });
  } catch (err) {
    log.error({ err }, "Failed to enqueue scrape job");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/train", verifyAdminToken, async (_req, res) => {
  try {
    await trainingQueue.add("train-model", {});
    return res.status(202).json({ message: "Training job enqueued" });
  } catch (err) {
    log.error({ err }, "Failed to enqueue training job");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
