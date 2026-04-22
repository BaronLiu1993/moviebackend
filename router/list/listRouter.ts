import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import {
  createListSchema,
  deleteListSchema,
  renameListSchema,
  addListItemSchema,
  removeListItemSchema,
  getListItemsQuerySchema,
  createListInviteSchema,
  redeemListInviteSchema,
  getListInvitesQuerySchema,
  removeMemberSchema,
  getListMembersQuerySchema,
} from "../../schemas/listSchema.js";
import {
  createList,
  getUserLists,
  deleteList,
  renameList,
  addListItem,
  removeListItem,
  getListItems,
  createListInvite,
  redeemListInvite,
  getListInvites,
  removeMember,
  getListMembers,
} from "../../service/list/listService.js";
import type { UUID } from "node:crypto";
import log from "../../lib/logger.js";

const router = Router();

router.post("/", verifyToken, validateZod(createListSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const { name, hasImage } = req.body;

  try {
    const list = await createList({ supabaseClient, userId, name, hasImage });
    return res.status(201).json({ data: list });
  } catch (err) {
    if (err instanceof Error && err.message === "A list with this name already exists") {
      return res.status(409).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;

  try {
    const lists = await getUserLists({ supabaseClient, userId });
    return res.status(200).json({ data: lists });
  } catch (err) {
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/", verifyToken, validateZod(deleteListSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const { listId } = req.body;

  try {
    await deleteList({ supabaseClient, userId, listId });
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Access denied") return res.status(403).json({ message: err.message });
      if (err.message === "Cannot delete the default Watchlist") return res.status(403).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/", verifyToken, validateZod(renameListSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const { listId, name } = req.body;

  try {
    await renameList({ supabaseClient, userId, listId, name });
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Access denied") return res.status(403).json({ message: err.message });
      if (err.message === "Cannot rename the default Watchlist") return res.status(403).json({ message: err.message });
      if (err.message === "A list with this name already exists") return res.status(409).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


router.post("/items", verifyToken, validateZod(addListItemSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const accessToken = req.token!;
  const { listId, tmdbId, title, genre_ids, poster_url } = req.body;

  try {
    await addListItem({ supabaseClient, userId, listId, tmdbId, title, genre_ids, poster_url, accessToken });
    return res.status(201).send();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Access denied") return res.status(403).json({ message: err.message });
      if (err.message === "Film already in this list") return res.status(409).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/items", verifyToken, validateZod(removeListItemSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const accessToken = req.token!;
  const { listId, tmdbId } = req.body;

  try {
    await removeListItem({ supabaseClient, userId, listId, tmdbId, accessToken });
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Access denied") return res.status(403).json({ message: err.message });
      if (err.message === "Can only remove items you added") return res.status(403).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/items", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;

  const parsed = getListItemsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  const { listId, page, pageSize } = parsed.data;

  try {
    const items = await getListItems({ supabaseClient, userId, listId: listId as UUID, page, pageSize });
    return res.status(200).json({ data: items });
  } catch (err) {
    if (err instanceof Error && err.message === "Access denied") {
      return res.status(403).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


router.post("/invite", verifyToken, validateZod(createListInviteSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const { listId } = req.body;

  try {
    const invite = await createListInvite({ supabaseClient, userId, listId });
    const baseUrl = process.env.CORS_ORIGIN || "http://localhost:3000";
    return res.status(201).json({
      code: invite.code,
      url: `${baseUrl}/list-invite/${invite.code}`,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Access denied") return res.status(403).json({ message: err.message });
      if (err.message === "Cannot share the default Watchlist") return res.status(403).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/redeem-invite", verifyToken, validateZod(redeemListInviteSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const { code } = req.body;

  try {
    const result = await redeemListInvite({ supabaseClient, userId, code });
    return res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Invite not found or expired") return res.status(404).json({ message: err.message });
      if (err.message === "Cannot redeem your own invite") return res.status(403).json({ message: err.message });
      if (err.message === "Must be friends with the list owner") return res.status(403).json({ message: err.message });
      if (err.message === "Already a member of this list") return res.status(409).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/invite", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;

  const parsed = getListInvitesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  const { listId } = parsed.data;

  try {
    const invites = await getListInvites({ supabaseClient, userId, listId: listId as UUID });
    return res.status(200).json({ data: invites });
  } catch (err) {
    if (err instanceof Error && err.message === "Access denied") {
      return res.status(403).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/members", verifyToken, validateZod(removeMemberSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const { listId, userId: targetUserId } = req.body;

  try {
    await removeMember({ supabaseClient, userId, listId, targetUserId });
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Access denied") return res.status(403).json({ message: err.message });
      if (err.message === "Cannot remove yourself as owner") return res.status(400).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/members", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;

  const parsed = getListMembersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  const { listId } = parsed.data;

  try {
    const members = await getListMembers({ supabaseClient, userId, listId: listId as UUID });
    return res.status(200).json({ data: members });
  } catch (err) {
    if (err instanceof Error && err.message === "Access denied") {
      return res.status(403).json({ message: err.message });
    }
    log.error({ err }, "List router error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
