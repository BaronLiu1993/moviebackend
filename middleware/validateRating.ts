import { type Request, type Response, type NextFunction } from "express";

export async function validateInsertRating(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { tmdbId, rating, note, name, genre_ids } = req.body;
  const userId = req.user?.sub;

  if (!tmdbId || !userId || !rating || !req.supabaseClient || !note || !name || !genre_ids) {
    res.status(400).json({ message: "Missing Inputs" });
    return;
  }

  if (!req.token) {
    res.status(401).json({ message: "Missing Access Token" });
    return;
  }

  if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
    return;
  }

  if (typeof note !== "string" || note.length < 10 || note.length > 500) {
    res.status(400).json({ message: "Note must be between 10 and 500 characters" });
    return;
  }

  if (typeof tmdbId !== "number" || !Number.isInteger(tmdbId)) {
    res.status(400).json({ message: "tmdb must be an integer" });
    return;
  }

  if (!Array.isArray(genre_ids)) {
    res.status(400).json({ message: "genre_ids must be a non-empty array" });
    return;
  }

  const { data, error } = await req.supabaseClient!
    .from("Guanghai")
    .select("tmdb_id")
    .eq("tmdb_id", tmdbId)
    .single();

  if (error || !data) {
    res.status(404).json({ message: "Film not found" });
    return;
  }

  next();
}

export async function validateUpdateRating(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { ratingId, newRating, newNote } = req.body;
  const userId = req.user?.sub;

  if (!userId || !ratingId || !newRating || !req.supabaseClient || !newNote) {
    res.status(400).json({ message: "Missing Inputs" });
    return;
  }

  if (!req.token) {
    res.status(401).json({ message: "Missing Access Token" });
    return;
  }

  if (typeof newRating !== "number" || newRating < 1 || newRating > 5 || !Number.isInteger(newRating)) {
    res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
    return;
  }

  if (typeof newNote !== "string" || newNote.length < 10 || newNote.length > 500) {
    res.status(400).json({ message: "Note must be between 10 and 500 characters" });
    return;
  }

  const { data, error } = await req.supabaseClient!
    .from("Ratings")
    .select("rating_id")
    .eq("rating_id", ratingId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    res.status(404).json({ message: "Rating not found" });
    return;
  }

  next();
}
