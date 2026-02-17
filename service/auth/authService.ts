/**
 * It acts as the authentication service layer between the API routes,
 * Supabase (auth + database), and OpenAI.
 */

import { createSignInSupabase } from "../supabase/configureSupabase.js";
import { fetchTmdbOverview, fetchTmdbKeywords } from "../tmdb/tmdbService.js";
import OpenAI from "openai";
import dotenv from "dotenv";
import type { UUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

dotenv.config();

// config
const SCOPES = "email,profile";
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
  throw new Error("Missing OPENAI_API_KEY");
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// types
interface ProfileChangeRequest {
  userId: UUID;
  inputString: string;
  supabaseClient: SupabaseClient;
}

interface RegisterUserRequest {
  userId: UUID;
  genres: string;
  movies?: string;
  moods?: string;
  dislikedGenres?: string;
  movieIds?: number[];
  supabaseClient: SupabaseClient;
}

// helpers
// Ensures a user can only complete profile registration once
const checkRegistration = async (
  supabaseClient: SupabaseClient,
  userId: UUID
): Promise<boolean> => {
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
  } catch (err) {
    throw err;
  }
};

// auth
// Initiates Google OAuth sign-in and returns the redirect URL
export const handleSignIn = async (): Promise<string> => {
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
  } catch (err) {
    throw err;
  }
};

// profile
// Generates an OpenAI embedding for a user's interest profile (one-time only)
const generateInterestProfileVector = async ({
  inputString,
  userId,
  supabaseClient,
}: ProfileChangeRequest): Promise<number[]> => {
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
export const registerUser = async ({
  userId,
  genres,
  movies,
  moods,
  dislikedGenres,
  movieIds,
  supabaseClient,
}: RegisterUserRequest): Promise<void> => {
  // Fetch TMDB overviews for selected movies
  const movieTitles = movies
    ? movies.split(",").map((m: string) => m.trim())
    : [];

  let movieDescriptions: string[] = [];

  if (movieIds && movieIds.length > 0) {
    const capped = movieIds.slice(0, 10);
    const [overviewResults, keywordResults] = await Promise.all([
      Promise.allSettled(capped.map((id: number) => fetchTmdbOverview(id))),
      Promise.allSettled(capped.map((id: number) => fetchTmdbKeywords(id))),
    ]);
    movieDescriptions = overviewResults.map((result, index) => {
      let desc: string;
      if (result.status === "fulfilled" && result.value) {
        const { title, overview } = result.value;
        desc = overview ? `${title} - ${overview}` : movieTitles[index] || title;
      } else {
        desc = movieTitles[index] || "Unknown";
      }

      const kwResult = keywordResults[index];
      if (kwResult && kwResult.status === "fulfilled" && kwResult.value.length > 0) {
        desc += ` (keywords: ${kwResult.value.join(", ")})`;
      }
      return desc;
    });
  } else {
    movieDescriptions = movieTitles;
  }

  // Build structured natural-language input string
  const parts: string[] = [];
  parts.push(`Favorite genres: ${genres}.`);
  if (moods) parts.push(`Mood preferences: ${moods}.`);
  if (dislikedGenres) parts.push(`Dislikes: ${dislikedGenres}.`);
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
      genres: genres.split(",").map((genre: string) => genre.trim()),
      movies: movies ? movies.split(",").map((movie: string) => movie.trim()) : [],
      moods: moods ? moods.split(",").map((m: string) => m.trim()) : [],
      disliked_genres: dislikedGenres
        ? dislikedGenres.split(",").map((g: string) => g.trim())
        : [],
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error("Failed to update profile");
  }
};