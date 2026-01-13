import { Router } from "express";

const router = Router();

router.get("/test-friend", async (req, res) => {
  return res.status(200).json({ message: "Friend Router Works!" });
});

export default router;