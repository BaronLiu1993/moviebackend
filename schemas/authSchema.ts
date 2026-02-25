import * as z from "zod";

export const registerRequestSchema = z.object({
    genres: z.array(z.string()),
    movies: z.array(z.string()),
    moods: z.array(z.string()),
    dislikedGenres: z.array(z.string()),
    movieIds: z.array(z.number())
})

export const createAccountSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
    name: z.string().min(2)
})

export type RegisterRequest = z.infer<typeof registerRequestSchema>;