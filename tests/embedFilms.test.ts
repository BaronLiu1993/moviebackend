import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type AnyFn = (...args: any[]) => any;

const mockSelect = jest.fn<AnyFn>();
const mockIs = jest.fn<AnyFn>();
const mockUpdate = jest.fn<AnyFn>();
const mockEq = jest.fn<AnyFn>();
const mockFrom = jest.fn<AnyFn>();
const mockSupabase = { from: mockFrom } as any;

jest.unstable_mockModule("../service/supabase/configureSupabase.js", () => ({
  createServerSideSupabaseClient: () => mockSupabase,
}));

const mockGenerateFilmEmbeddings = jest.fn<AnyFn>();
jest.unstable_mockModule("../etl/generateEmbeddings.js", () => ({
  generateFilmEmbeddings: mockGenerateFilmEmbeddings,
}));

jest.unstable_mockModule("../etl/buildEmbeddingInput.js", () => ({
  buildFilmEmbeddingInput: (film: any) => `Title: ${film.title}.`,
}));

const { embedFilms } = await import("../etl/embedFilms.js");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("embedFilms", () => {
  it("skips when no unembedded films found", async () => {
    mockFrom.mockReturnValue({
      select: () => ({ is: () => Promise.resolve({ data: [], error: null }) }),
    });

    await embedFilms();

    expect(mockGenerateFilmEmbeddings).not.toHaveBeenCalled();
  });

  it("embeds films and updates Guanghai", async () => {
    const films = [
      { tmdb_id: 1, title: "Film A", overview: "overview", genre_ids: [18], release_year: "2021", media_type: "tv" },
      { tmdb_id: 2, title: "Film B", overview: "overview", genre_ids: [35], release_year: "2022", media_type: "movie" },
    ];
    const embeddings = [Array(1536).fill(0.1), Array(1536).fill(0.2)];

    // First call: select unembedded
    // Subsequent calls: update each film
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: () => ({
            is: () => Promise.resolve({ data: films, error: null }),
          }),
        };
      }
      // update calls
      return {
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      };
    });

    mockGenerateFilmEmbeddings.mockResolvedValueOnce(embeddings);

    await embedFilms();

    expect(mockGenerateFilmEmbeddings).toHaveBeenCalledWith([
      "Title: Film A.",
      "Title: Film B.",
    ]);
    // 1 select + 2 updates = 3 from() calls
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it("throws on fetch error", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        is: () => Promise.resolve({ data: null, error: { message: "db error" } }),
      }),
    });

    await expect(embedFilms()).rejects.toThrow("Failed to fetch unembedded films");
  });
});
