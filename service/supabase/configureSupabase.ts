/*
 * It ensures environment variables are present and sets appropriate headers/auth options
 * depending on the type of client being created.
*/

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// config
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

// types
type CreateSupabaseClientType = {
  accessToken: string;
};

// client for authenticated requests from the browser or frontend
export const createSupabaseClient = ({ accessToken }: CreateSupabaseClientType) => {
  if (!SUPABASE_ANON_KEY || !SUPABASE_URL) {
    throw new Error("Missing Supabase keys or URL");
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
};

// client specifically for OAuth sign-in flows (e.g., Google)
export const createSignInSupabase = () => {
  if (!SUPABASE_ANON_KEY || !SUPABASE_URL) {
    throw new Error("Missing Supabase keys or URL");
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
};

// server-side client using the service role for admin operations
export const createServerSideSupabaseClient = () => {
  if (!SUPABASE_SERVICE_ROLE || !SUPABASE_URL) {
    throw new Error("Missing Supabase service role key or URL");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};
