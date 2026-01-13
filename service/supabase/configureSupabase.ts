import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv"

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE

type CreateSupabaseClientType = {
  accessToken: string;
};

export const createSupabaseClient = ({
  accessToken,
}: CreateSupabaseClientType) => {
  if (!SUPABASE_ANON_KEY || !SUPABASE_URL) {
    throw new Error("Missing Keys or URL");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  return supabase;
};

export const createSignInSupabase = () => {
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

export const createServerSideSupabaseClient = () => {
  if (!SUPABASE_SERVICE_ROLE || !SUPABASE_URL) {
    throw new Error("Missing Service Role or URL")
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return supabaseAdmin
}
