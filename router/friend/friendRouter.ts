import { Router } from "express";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFollowers,
  getFollowing,
  getProfile,
  getFriendRequests,
  createInvite,
  redeemInvite,
  getActiveInvites,
} from "../../service/friend/friendService.js";
import type { UUID } from "node:crypto";
import { verifyToken } from "../../middleware/verifyToken.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import { sendFriendRequestSchema, acceptFriendRequestSchema, declineFriendRequestSchema, removeFriendSchema, getProfileQuerySchema, paginationQuerySchema, redeemInviteSchema } from "../../schemas/friendSchema.js";

const router = Router();

router.post("/send-request", verifyToken, validateZod(sendFriendRequestSchema), async (req, res) => {
  const { friendId } = req.body;
  const supabaseClient = req.supabaseClient!;
  const userId = req.user?.sub as UUID;

  try {
    await sendFriendRequest({ userId, friendId, supabaseClient });
    return res.status(201).send();
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/friend-requests", verifyToken, async (req, res) => {
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!userId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  try {
    const data = await getFriendRequests({ userId, supabaseClient, ...parsed.data });
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/accept-request", verifyToken, validateZod(acceptFriendRequestSchema), async (req, res) => {
  const { requestId } = req.body;
  const supabaseClient = req.supabaseClient!;
  const userId = req.user?.sub as UUID;
  try {
    await acceptFriendRequest({ userId, requestId, supabaseClient });
    return res.status(201).send();
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/decline-request", verifyToken, validateZod(declineFriendRequestSchema), async (req, res) => {
  const { requestId } = req.body;
  const supabaseClient = req.supabaseClient!;
  const userId = req.user?.sub as UUID;

  try {
    await rejectFriendRequest({ userId, requestId, supabaseClient });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/unfriend", verifyToken, validateZod(removeFriendSchema), async (req, res) => {
  const { friendId } = req.body;
  const supabaseClient = req.supabaseClient!;
  const userId = req.user?.sub as UUID;

  try {
    await removeFriend({ userId, friendId, supabaseClient });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/following", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient;

  if (!userId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  try {
    const data = await getFollowing({ userId, supabaseClient, ...parsed.data });
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/followers", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient;

  if (!userId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  try {
    const data = await getFollowers({ userId, supabaseClient, ...parsed.data });
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/profile", verifyToken, async (req, res) => {
  const supabaseClient = req.supabaseClient;
  const userId = req.user?.sub as UUID;

  if (!userId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  const parsed = getProfileQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  try {
    const data = await getProfile({
      userId,
      supabaseClient,
      friendId: parsed.data.friendId as UUID,
    });
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// --- Invite Links ---

router.post("/invite", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;

  try {
    const invite = await createInvite({ supabaseClient, userId });
    const baseUrl = process.env.CORS_ORIGIN || "http://localhost:3000";
    return res.status(201).json({
      code: invite.code,
      url: `${baseUrl}/invite/${invite.code}`,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/invite", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;

  try {
    const invites = await getActiveInvites({ supabaseClient, userId });
    return res.status(200).json({ data: invites });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/redeem-invite", verifyToken, validateZod(redeemInviteSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const { code } = req.body;

  try {
    const result = await redeemInvite({ supabaseClient, userId, code });
    return res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Invite not found or expired") return res.status(404).json({ message: err.message });
      if (err.message === "Cannot redeem your own invite") return res.status(403).json({ message: err.message });
      if (err.message === "Already friends") return res.status(409).json({ message: err.message });
    }
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
