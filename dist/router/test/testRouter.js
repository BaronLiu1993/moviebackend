import { Router } from "express";
import { createSignInSupabase, createSupabaseClient, createServerSideSupabaseClient } from "../../service/supabase/configureSupabase.js";
const router = Router();
// Sign up with email/password — creates auth user + User_Profiles row
router.post("/signup", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Missing email or password" });
    }
    try {
        const supabase = createSignInSupabase();
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name || "Test User" } },
        });
        if (error || !data.session) {
            return res.status(400).json({ message: error?.message || "Signup failed — check if email confirmation is required in Supabase settings" });
        }
        const { session, user } = data;
        const supabaseClient = createSupabaseClient({ accessToken: session.access_token });
        const { error: insertError } = await supabaseClient
            .from("User_Profiles")
            .insert({
            user_id: user.id,
            email: user.email,
            name: name || user.user_metadata?.full_name || "Test User",
        });
        if (insertError) {
            return res.status(400).json({ message: "User created but profile insert failed", detail: insertError.message });
        }
        return res.status(200).json({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            userId: user.id,
        });
    }
    catch {
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
// Login with email/password — returns access token
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Missing email or password" });
    }
    try {
        const supabase = createSignInSupabase();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error || !data.session) {
            return res.status(401).json({ message: error?.message || "Login failed" });
        }
        return res.status(200).json({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            userId: data.user.id,
        });
    }
    catch {
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
export default router;
//# sourceMappingURL=testRouter.js.map