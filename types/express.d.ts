import type { SupabaseClient } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: { sub: string; email?: string };
      token?: string;
      supabaseClient?: SupabaseClient;
    }
  }
}
