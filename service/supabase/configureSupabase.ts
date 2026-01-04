import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

type CreateSupabaseClientType = {
  accessToken: string;
};

export const createServerSideClient = {};

export const createSupbaseClient = ({
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
