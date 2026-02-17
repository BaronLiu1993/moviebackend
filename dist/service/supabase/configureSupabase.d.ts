type CreateSupabaseClientType = {
    accessToken: string;
};
export declare const createSupabaseClient: ({ accessToken }: CreateSupabaseClientType) => import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export declare const createSignInSupabase: () => import("@supabase/supabase-js").SupabaseClient<unknown, {
    PostgrestVersion: string;
}, never, never, {
    PostgrestVersion: string;
}>;
export declare const createServerSideSupabaseClient: () => import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export {};
//# sourceMappingURL=configureSupabase.d.ts.map