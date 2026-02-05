import { Router } from "express";
import {
  acceptFriendRequest,
  getFollowers,
  getFollowing,
  getProfile,
  rejectFriendRequest,
  sendFriendRequest,
} from "../../service/auth/authService.js";
import type { UUID } from "node:crypto";
import { verifyToken } from "../../middleware/verifyToken.js";

const router = Router();

router.post("/send-request", verifyToken, async (req, res) => {
  const { friendId } = req.body;
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!userId || !friendId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    await sendFriendRequest({ userId, friendId, supabaseClient });
    return res.status(200).json({ message: "Friend request sent" });
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/accept-request", verifyToken, async (req, res) => {
  const { requestId } = req.body;
  const supabaseClient = req.supabaseClient;

  if (!requestId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  try {
    await acceptFriendRequest({ requestId, supabaseClient });
    return res.status(200).json({ message: "Friend request accepted" });
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/decline-request", verifyToken, async (req, res) => {
  const { requestId } = req.body;
  const supabaseClient = req.supabaseClient;

  if (!requestId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    await rejectFriendRequest({ requestId, supabaseClient });
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/get-following", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient;

  if (!userId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  try {
    const data = await getFollowing({ userId, supabaseClient });
    return res.status(200).json({ data });
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/get-followers", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient;

  if (!userId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    const data = await getFollowers({ userId, supabaseClient });
    return res.status(200).json({ data });
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/get-profile", verifyToken, async (req, res) => {
  const { friendId } = req.query;
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!userId || !friendId || !supabaseClient || typeof friendId !== "string") {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    const data = await getProfile({
      userId,
      supabaseClient,
      friendId: friendId as UUID,
    });
    return res.status(200).json({ data });
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
