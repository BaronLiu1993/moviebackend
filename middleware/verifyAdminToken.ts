import { type Request, type Response, type NextFunction } from "express";

const ADMIN_TOKEN = process.env.CRON_ADMIN_TOKEN;

export async function verifyAdminToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cronToken = req.headers["x-cron-admin-token"];
    if (!cronToken) {
      res.status(401).json({ message: "Missing Cron Admin Token" });
      return;
    }

    if (cronToken !== ADMIN_TOKEN) {
      res.status(401).json({ message: "Invalid Cron Admin Token" });
      return;
    }

    next();
  } catch (err) {
    console.log(err);
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
}
