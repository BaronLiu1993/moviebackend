import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { type NextFunction, type Request, type Response } from "express";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const SUPABASE_JWT_ALGORITHM = process.env.SUPABASE_JWT_ALGORITHM;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: "Missing Authorization header" });
    }
  
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }
  
    try {
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
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  }