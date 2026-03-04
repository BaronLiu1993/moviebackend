import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import {
  selectBookmarkFilms,
  bookmarkFilm,
  removeBookmark,
} from "../../service/bookmarkService/bookmarkService.js";
import { validateZod } from "../../middleware/schemaValidation.js";
import {
  bookmarkFilmRequestSchema,
  removeBookmarkRequestSchema,
  selectBookmarksRequestSchema,
} from "../../schemas/bookmarkSchema.js";
import type { UUID } from "node:crypto";

const router = Router();

router.get("/select-bookmarks", verifyToken, async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;

  if (!userId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  const parsed = selectBookmarksRequestSchema.safeParse(req.query);
  
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters"});
  }

  const { page } = parsed.data;

  try {
    const bookmarks = await selectBookmarkFilms({ supabaseClient, userId, page });
    return res.status(200).json({ data: bookmarks });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/bookmark", verifyToken, validateZod(bookmarkFilmRequestSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const { tmdbId, title, genre } = req.body;

  if (!userId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    await bookmarkFilm({ supabaseClient, userId, tmdbId, title, genre });
    return res.status(201).send();
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/remove-bookmark", verifyToken, validateZod(removeBookmarkRequestSchema), async (req, res) => {
  const userId = req.user?.sub as UUID;
  const supabaseClient = req.supabaseClient!;
  const { tmdbId } = req.body;

  if (!userId || !supabaseClient) {
    return res.status(400).json({ message: "Missing Inputs" });
  }

  try {
    await removeBookmark({ supabaseClient, userId, tmdbId, title: "", genre: [] });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
