process.env["OPENAI_API_KEY"] = "test-key";

const mockSignUp = jest.fn();
const mockSignIn = jest.fn();
const mockEmbeddingsCreate = jest.fn();
const mockSupabaseFrom = jest.fn();

jest.mock("../service/supabase/configureSupabase.js", () => ({
  createSignInSupabase: () => ({
    auth: { signUp: mockSignUp, signInWithPassword: mockSignIn },
  }),
  createSupabaseClient: () => ({ from: mockSupabaseFrom }),
}));

jest.mock("../service/tmdb/tmdbService.js", () => ({
  fetchTmdbOverview: jest.fn().mockResolvedValue({ title: "Test Drama", overview: "A test overview" }),
  fetchTmdbKeywords: jest.fn().mockResolvedValue(["drama", "romance"]),
}));

jest.mock("openai", () => ({
  default: class {
    embeddings = { create: mockEmbeddingsCreate };
  },
}));

import { signUpUser, loginUser, registerUser } from "../service/auth/authService.js";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("signUpUser", () => {
  it("signs up and creates a user profile", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: {
        session: { access_token: "at", refresh_token: "rt" },
        user: { id: "uid-1", email: "a@b.com", user_metadata: { full_name: "Test" } },
      },
      error: null,
    });
    const insertFn = jest.fn().mockResolvedValue({ error: null });
    mockSupabaseFrom.mockReturnValue({ insert: insertFn });

    const result = await signUpUser({ email: "a@b.com", password: "pass123", name: "Test" });

    expect(result).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      userId: "uid-1",
    });
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "uid-1", email: "a@b.com", name: "Test" })
    );
  });

  it("throws when supabase auth fails", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: "Email already exists" },
    });

    await expect(
      signUpUser({ email: "a@b.com", password: "pass" })
    ).rejects.toThrow("Email already exists");
  });

  it("throws when profile insert fails", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: {
        session: { access_token: "at", refresh_token: "rt" },
        user: { id: "uid-2", email: "b@c.com", user_metadata: {} },
      },
      error: null,
    });
    const insertFn = jest.fn().mockResolvedValue({ error: { message: "constraint" } });
    mockSupabaseFrom.mockReturnValue({ insert: insertFn });

    await expect(
      signUpUser({ email: "b@c.com", password: "pass" })
    ).rejects.toThrow("User created but profile insert failed");
  });
});

describe("loginUser", () => {
  it("returns tokens on successful login", async () => {
    mockSignIn.mockResolvedValueOnce({
      data: {
        session: { access_token: "at", refresh_token: "rt" },
        user: { id: "uid-1" },
      },
      error: null,
    });

    const result = await loginUser({ email: "a@b.com", password: "pass" });

    expect(result).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      userId: "uid-1",
    });
  });

  it("throws on invalid credentials", async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    });

    await expect(loginUser({ email: "a@b.com", password: "wrong" })).rejects.toThrow(
      "Invalid login credentials"
    );
  });
});

describe("registerUser", () => {
  const mockUserSupabase = { from: jest.fn() } as any;
  const baseArgs = {
    userId: "uid-1" as any,
    genres: "drama,romance",
    supabaseClient: mockUserSupabase,
  };

  it("generates embedding and updates profile", async () => {
    const singleCheck = jest.fn().mockResolvedValue({
      data: { completed_registration: false },
      error: null,
    });
    const eqCheck = jest.fn().mockReturnValue({ single: singleCheck });
    const selectCheck = jest.fn().mockReturnValue({ eq: eqCheck });

    const eqUpdate = jest.fn().mockResolvedValue({ error: null });
    const updateFn = jest.fn().mockReturnValue({ eq: eqUpdate });

    mockUserSupabase.from
      .mockReturnValueOnce({ select: selectCheck })
      .mockReturnValueOnce({ update: updateFn });

    mockEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: new Array(384).fill(0.1) }],
    });

    await registerUser(baseArgs);

    expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "text-embedding-3-small" })
    );
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        completed_registration: true,
        genres: ["drama", "romance"],
      })
    );
  });

  it("throws if user already registered", async () => {
    const singleCheck = jest.fn().mockResolvedValue({
      data: { completed_registration: true },
      error: null,
    });
    const eqCheck = jest.fn().mockReturnValue({ single: singleCheck });
    const selectCheck = jest.fn().mockReturnValue({ eq: eqCheck });
    mockUserSupabase.from.mockReturnValueOnce({ select: selectCheck });

    await expect(registerUser(baseArgs)).rejects.toThrow("User has already completed registration");
  });

  it("throws if embedding generation fails", async () => {
    const singleCheck = jest.fn().mockResolvedValue({
      data: { completed_registration: false },
      error: null,
    });
    const eqCheck = jest.fn().mockReturnValue({ single: singleCheck });
    const selectCheck = jest.fn().mockReturnValue({ eq: eqCheck });
    mockUserSupabase.from.mockReturnValueOnce({ select: selectCheck });

    mockEmbeddingsCreate.mockResolvedValueOnce({ data: [{}] });

    await expect(registerUser(baseArgs)).rejects.toThrow("Failed to generate embedding");
  });

  it("fetches TMDB overviews when movieIds are provided", async () => {
    const singleCheck = jest.fn().mockResolvedValue({
      data: { completed_registration: false },
      error: null,
    });
    const eqCheck = jest.fn().mockReturnValue({ single: singleCheck });
    const selectCheck = jest.fn().mockReturnValue({ eq: eqCheck });

    const eqUpdate = jest.fn().mockResolvedValue({ error: null });
    const updateFn = jest.fn().mockReturnValue({ eq: eqUpdate });

    mockUserSupabase.from
      .mockReturnValueOnce({ select: selectCheck })
      .mockReturnValueOnce({ update: updateFn });

    mockEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: new Array(384).fill(0.1) }],
    });

    await registerUser({
      ...baseArgs,
      movies: "Squid Game",
      movieIds: [12345],
      moods: "tense,dramatic",
      dislikedGenres: "horror",
    });

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        movies: ["Squid Game"],
        moods: ["tense", "dramatic"],
        disliked_genres: ["horror"],
      })
    );
  });
});
