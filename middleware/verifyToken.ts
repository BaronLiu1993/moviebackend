import { type Request, type Response, type NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

declare module "express-serve-static-core" {
  interface Request {
    user?: JwtPayload | string;
    token?: string;
    supabaseClient?: SupabaseClient;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;
const SUPABASE_JWT_ALGORITHM = process.env.SUPABASE_JWT_ALGORITHM as "HS256"; 

export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_JWT_SECRET || !SUPABASE_JWT_ALGORITHM) {
      throw new Error("Supabase key or JWT config missing in environment");
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ message: "Missing Authorization header" });
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "Missing token" });
      return;
    }

    const payload = jwt.verify(token, SUPABASE_JWT_SECRET, {
      algorithms: [SUPABASE_JWT_ALGORITHM],
    });

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    req.user = payload;
    req.token = token;
    req.supabaseClient = supabaseClient;

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
}
