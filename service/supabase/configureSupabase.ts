import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const createSupabase = () => {
  if (!SUPABASE_ANON_KEY || !SUPABASE_URL) {
    throw new Error("Missing Keys or URL");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  return supabase;
};
