import { Router } from "express";
import {
  acceptFriendRequest,
  getProfile,
  rejectFriendRequest,
  sendFriendRequest,
} from "../../service/auth/authService.js";
import type { UUID } from "node:crypto";

const router = Router();

router.post("/send-request", async (req, res) => {
  const { friendId } = req.body;
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!userId || !friendId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    await sendFriendRequest({ userId, friendId, supabaseClient });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/accept-request", async (req, res) => {
  const { requestId } = req.body;
  const supabaseClient = req.supabaseClient;

  if (!requestId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }
  try {
    await acceptFriendRequest({ requestId, supabaseClient });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/decline-request", async (req, res) => {
  const { requestId } = req.body;
  const supabaseClient = req.supabaseClient;

  if (!requestId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    await rejectFriendRequest({ requestId, supabaseClient });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/get-profile", async (req, res) => {
  const { friendId } = req.query;
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!userId || !friendId || !supabaseClient || typeof friendId !== 'string') {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    const data = await getProfile({ 
      userId, 
      supabaseClient, 
      friendId: friendId as UUID 
    });
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ 
      message: error instanceof Error ? error.message : "Internal Server Error" 
    });
  }
});

export default router;
