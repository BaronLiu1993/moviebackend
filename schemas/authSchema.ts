import * as z from "zod";

export const signupRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2).optional(),
});

export const loginRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export const registerRequestSchema = z.object({
    genres: z.array(z.string()),
    movies: z.array(z.string()),
    moods: z.array(z.string()),
    dislikedGenres: z.array(z.string()),
    movieIds: z.array(z.number()),
});

export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;