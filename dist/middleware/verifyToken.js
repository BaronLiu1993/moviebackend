import {} from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
export async function verifyToken(req, res, next) {
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error("Supabase URL or anon key missing in environment");
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
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        });
        const { data, error } = await supabaseClient.auth.getUser();
        if (error || !data.user) {
            res.status(401).json({ message: "Invalid or expired token" });
            return;
        }
        req.user = { sub: data.user.id, ...(data.user.email && { email: data.user.email }) };
        req.token = token;
        req.supabaseClient = supabaseClient;
        next();
    }
    catch (err) {
        console.log(err);
        res.status(401).json({ message: "Invalid or expired token" });
        return;
    }
}
//# sourceMappingURL=verifyToken.js.map