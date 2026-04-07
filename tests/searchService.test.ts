import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type AnyFn = (...args: any[]) => any;

const mockGenerateFilmEmbeddings = jest.fn<AnyFn>();
jest.unstable_mockModule("../etl/generateEmbeddings.js", () => ({
  generateFilmEmbeddings: mockGenerateFilmEmbeddings,
}));

const { searchFilms } = await import("../service/search/searchService.js");

const mockRpc = jest.fn<AnyFn>();
const supabaseClient = { rpc: mockRpc } as any;

const mockEmbedding = Array(1536).fill(0.1);

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerateFilmEmbeddings.mockResolvedValue([mockEmbedding]);
});

const film = (id: number, title: string) => ({
  tmdb_id: id,
  title,
  release_year: "2024",
  genre_ids: [18],
  media_type: "tv",
  photo_url: null,
});

describe("searchFilms", () => {
  it("fuses keyword and semantic results via RRF", async () => {
    // Keyword returns films 1, 2
    // Semantic returns films 2, 3
    // Film 2 appears in both → should be boosted
    mockRpc
      .mockResolvedValueOnce({ data: [film(1, "Drama A"), film(2, "Drama B")], error: null })
      .mockResolvedValueOnce({ data: [film(2, "Drama B"), film(3, "Drama C")], error: null });

    const result = await searchFilms({
      supabaseClient,
      query: "drama",
      page: 1,
      pageSize: 20,
    });

    expect(result.films.length).toBe(3);
    expect(result.total).toBe(3);
    // Film 2 should be first (appears in both lists)
    expect(result.films[0]!.tmdb_id).toBe(2);
  });

  it("returns semantic results when keyword returns empty", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [film(1, "Film A")], error: null });

    const result = await searchFilms({
      supabaseClient,
      query: "loneliness",
      page: 1,
      pageSize: 20,
    });

    expect(result.films.length).toBe(1);
    expect(result.films[0]!.tmdb_id).toBe(1);
  });

  it("returns keyword results when semantic returns empty", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: [film(1, "Film A")], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await searchFilms({
      supabaseClient,
      query: "squid game",
      page: 1,
      pageSize: 20,
    });

    expect(result.films.length).toBe(1);
  });

  it("paginates correctly", async () => {
    const films = Array.from({ length: 10 }, (_, i) => film(i + 1, `Film ${i + 1}`));
    mockRpc
      .mockResolvedValueOnce({ data: films, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await searchFilms({
      supabaseClient,
      query: "test",
      page: 2,
      pageSize: 3,
    });

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(3);
    expect(result.films.length).toBe(3);
    expect(result.total).toBe(10);
    // Page 2 should start at film 4
    expect(result.films[0]!.tmdb_id).toBe(4);
  });

  it("passes filters to RPCs", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await searchFilms({
      supabaseClient,
      query: "romance",
      page: 1,
      pageSize: 20,
      mediaType: "tv",
      genreIds: [18, 35],
    });

    expect(mockRpc).toHaveBeenCalledWith("search_films_keyword", {
      search_query: "romance",
      filter_media_type: "tv",
      filter_genre_ids: [18, 35],
      result_limit: 100,
    });
    expect(mockRpc).toHaveBeenCalledWith("search_films_semantic", {
      query_embedding: mockEmbedding,
      filter_media_type: "tv",
      filter_genre_ids: [18, 35],
      result_limit: 100,
    });
  });

  it("throws on keyword RPC error", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: null, error: { message: "keyword fail" } })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(
      searchFilms({ supabaseClient, query: "test", page: 1, pageSize: 20 }),
    ).rejects.toThrow("Keyword search failed");
  });

  it("throws on semantic RPC error", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "semantic fail" } });

    await expect(
      searchFilms({ supabaseClient, query: "test", page: 1, pageSize: 20 }),
    ).rejects.toThrow("Semantic search failed");
  });
});
