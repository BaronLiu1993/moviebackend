/**
 * It acts as the authentication service layer between the API routes,
 * Supabase (auth + database), and OpenAI.
 */
import { createSignInSupabase } from "../supabase/configureSupabase.js";
import { fetchTmdbOverview } from "../tmdb/tmdbService.js";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
// config
const SCOPES = "email,profile";
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
}
const openai = new OpenAI({ apiKey: OPENAI_KEY });
// helpers
// Ensures a user can only complete profile registration once
const checkRegistration = async (supabaseClient, userId) => {
    try {
        const { data, error } = await supabaseClient
            .from("User_Profiles")
            .select("completed_registration")
            .eq("user_id", userId)
            .single();
        if (error || !data) {
            throw new Error("Failed to check registration status");
        }
        return data.completed_registration;
    }
    catch (err) {
        throw err;
    }
};
// auth
// Initiates Google OAuth sign-in and returns the redirect URL
export const handleSignIn = async () => {
    try {
        const supabase = createSignInSupabase();
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                scopes: SCOPES,
                redirectTo: "http://localhost:8000/v1/api/auth/oauth2callback",
            },
        });
        if (error || !data?.url) {
            throw new Error("Google OAuth sign-in failed");
        }
        return data.url;
    }
    catch (err) {
        throw err;
    }
};
// profile
// Generates an OpenAI embedding for a user's interest profile (one-time only)
const generateInterestProfileVector = async ({ inputString, userId, supabaseClient, }) => {
    const isRegistered = await checkRegistration(supabaseClient, userId);
    if (isRegistered) {
        throw new Error("User has already completed registration");
    }
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: inputString,
        encoding_format: "float",
    });
    if (!response.data[0]?.embedding) {
        throw new Error("Failed to generate embedding");
    }
    return response.data[0].embedding;
};
// Fetches TMDB overviews, builds enriched embedding string, generates vector, and updates User_Profiles
export const registerUser = async ({ userId, genres, movies, moods, dislikedGenres, movieIds, supabaseClient, }) => {
    // Fetch TMDB overviews for selected movies
    const movieTitles = movies
        ? movies.split(",").map((m) => m.trim())
        : [];
    let movieDescriptions = [];
    if (movieIds && movieIds.length > 0) {
        const capped = movieIds.slice(0, 10);
        const results = await Promise.allSettled(capped.map((id) => fetchTmdbOverview(id)));
        movieDescriptions = results.map((result, index) => {
            if (result.status === "fulfilled" && result.value) {
                const { title, overview } = result.value;
                return overview ? `${title} - ${overview}` : movieTitles[index] || title;
            }
            return movieTitles[index] || "Unknown";
        });
    }
    else {
        movieDescriptions = movieTitles;
    }
    // Build structured natural-language input string
    const parts = [];
    parts.push(`Favorite genres: ${genres}.`);
    if (moods)
        parts.push(`Mood preferences: ${moods}.`);
    if (dislikedGenres)
        parts.push(`Dislikes: ${dislikedGenres}.`);
    if (movieDescriptions.length > 0) {
        parts.push(`Favorite films: ${movieDescriptions.join("; ")}.`);
    }
    const inputString = parts.join(" ");
    const embedding = await generateInterestProfileVector({ inputString, supabaseClient, userId });
    const { error } = await supabaseClient
        .from("User_Profiles")
        .update({
        interest_embedding: embedding,
        profile_embedding: embedding,
        behavioral_embedding: null,
        behavioral_weight_sum: 0,
        rating_count: 0,
        completed_registration: true,
        genres: genres.split(",").map((genre) => genre.trim()),
        movies: movies ? movies.split(",").map((movie) => movie.trim()) : [],
        moods: moods ? moods.split(",").map((m) => m.trim()) : [],
        disliked_genres: dislikedGenres
            ? dislikedGenres.split(",").map((g) => g.trim())
            : [],
    })
        .eq("user_id", userId);
    if (error) {
        throw new Error("Failed to update profile");
    }
};
//# sourceMappingURL=authService.js.map