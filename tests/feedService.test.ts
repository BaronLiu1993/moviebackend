import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type AnyFn = (...args: any[]) => any;

const mockFetch = jest.fn<AnyFn>();
global.fetch = mockFetch as any;

import {
  getInitialFeed,
  getAiringDramas,
  getPopularDramas,
  getCollaborativeFilters,
  applyRRF,
  deduplicateCollaborative,
} from "../service/feed/feedService.js";

const mockFrom = jest.fn<AnyFn>();
const mockRpc = jest.fn<AnyFn>();
const supabaseClient = { from: mockFrom, rpc: mockRpc } as any;
const userId = "user-feed" as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getAiringDramas", () => {
  it("returns TMDB airing data", async () => {
    const tmdbData = { results: [{ id: 1, name: "Drama A" }] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tmdbData),
    });

    const result = await getAiringDramas();

    expect(result).toEqual(tmdbData);
    expect((mockFetch.mock.calls[0] as any[])[0]).toContain("/3/discover/tv");
    expect((mockFetch.mock.calls[0] as any[])[0]).toContain("with_origin_country=KR");
  });

  it("throws on TMDB API error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: "Server Error" });

    await expect(getAiringDramas()).rejects.toThrow("Failed to fetch currently airing Korean dramas");
  });
});

describe("getPopularDramas", () => {
  it("returns TMDB popular data sorted by popularity", async () => {
    const tmdbData = { results: [{ id: 2, name: "Popular Drama" }] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tmdbData),
    });

    const result = await getPopularDramas();

    expect(result).toEqual(tmdbData);
    expect((mockFetch.mock.calls[0] as any[])[0]).toContain("sort_by=popularity.desc");
  });

  it("throws on TMDB API error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: "Forbidden" });

    await expect(getPopularDramas()).rejects.toThrow("Failed to fetch popular Korean dramas");
  });
});

describe("getCollaborativeFilters", () => {
  it("returns films from top-K similar users", async () => {
    mockRpc.mockResolvedValueOnce({ data: ["friend-1", "friend-2"], error: null });

    const friendFilms = [{ film_id: 100, rating: 5, film_name: "Great Show", genre_ids: [18] }];
    const limit = jest.fn<AnyFn>().mockResolvedValue({ data: friendFilms, error: null });
    const gte = jest.fn<AnyFn>().mockReturnValue({ limit });
    const eq = jest.fn<AnyFn>().mockReturnValue({ gte });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const result = await getCollaborativeFilters({ supabaseClient, userId });

    expect(mockRpc).toHaveBeenCalledWith("get_collaborative_filters", { user_id: userId });
    expect(result.length).toBeGreaterThan(0);
  });

  it("throws on RPC error", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "rpc fail" } });

    await expect(getCollaborativeFilters({ supabaseClient, userId })).rejects.toThrow("Internal Server Error");
  });
});

describe("getInitialFeed", () => {
  it("returns a feed with films, page info, and hasMore", async () => {
    const recommended = Array.from({ length: 5 }, (_, i) => ({
      tmdb_id: i + 1,
      title: `Film ${i}`,
      release_year: "2024",
      film_id: `f${i}`,
      genre_ids: [18],
      similarity: 0.9 - i * 0.1,
      photo_url: null,
      media_type: "tv",
    }));
    mockRpc
      .mockResolvedValueOnce({ data: recommended, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [{ id: 100, name: "Popular", genre_ids: [18], poster_path: "/p.jpg", first_air_date: "2024-01-01" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [{ id: 200, name: "Airing", genre_ids: [35], poster_path: "/a.jpg", first_air_date: "2024-06-01" }] }),
      });

    const result = await getInitialFeed({ supabaseClient, userId, page: 1, pageSize: 20 });

    expect(result.films.length).toBeGreaterThan(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(typeof result.hasMore).toBe("boolean");
  });

  it("does not fetch popular/airing on subsequent pages", async () => {
    const recommended = [{ tmdb_id: 1, title: "F1", release_year: "2024", film_id: "f1", genre_ids: [18], similarity: 0.9, photo_url: null, media_type: "tv" }];
    mockRpc
      .mockResolvedValueOnce({ data: recommended, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await getInitialFeed({ supabaseClient, userId, page: 2, pageSize: 20 });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.page).toBe(2);
  });
});

describe("deduplicateCollaborative", () => {
  it("aggregates duplicate films by average rating", () => {
    const films = [
      { film_id: 1, rating: 4, film_name: "Drama A", genre_ids: [18] },
      { film_id: 1, rating: 5, film_name: "Drama A", genre_ids: [18] },
      { film_id: 2, rating: 4, film_name: "Drama B", genre_ids: [35] },
    ];

    const result = deduplicateCollaborative(films);

    expect(result).toHaveLength(2);
    expect(result[0]!.film_id).toBe(1);
    expect(result[0]!.rating).toBe(4.5);
    expect(result[1]!.film_id).toBe(2);
    expect(result[1]!.rating).toBe(4);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateCollaborative([])).toEqual([]);
  });

  it("sorts by average rating descending", () => {
    const films = [
      { film_id: 1, rating: 4, film_name: "A", genre_ids: [] },
      { film_id: 2, rating: 5, film_name: "B", genre_ids: [] },
    ];

    const result = deduplicateCollaborative(films);

    expect(result[0]!.film_id).toBe(2);
    expect(result[1]!.film_id).toBe(1);
  });
});

describe("applyRRF", () => {
  const film = (id: number, extra?: Partial<{ film_id: string; photo_url: string }>) => ({
    tmdb_id: id,
    title: `Film ${id}`,
    release_year: "2024",
    genre_ids: [18],
    ...extra,
  });

  it("ranks items by weighted RRF score", () => {
    const result = applyRRF([
      { name: "recommended", items: [film(1), film(2), film(3)] as any },
      { name: "popular", items: [film(4), film(5)] as any },
    ]);

    // recommended weight=1.0, popular weight=0.3
    // film(1) score = 1.0/(60+1) = 0.01639
    // film(4) score = 0.3/(60+1) = 0.00492
    expect(result[0]!.tmdb_id).toBe(1);
    expect(result.find((f) => f.tmdb_id === 4)).toBeTruthy();
  });

  it("boosts items appearing in multiple lists", () => {
    const result = applyRRF([
      { name: "recommended", items: [film(1), film(2), film(3)] as any },
      { name: "collaborative", items: [film(3), film(4)] as any },
    ]);

    // film(3): recommended rank 3 = 1.0/(60+3) + collaborative rank 1 = 0.7/(60+1)
    // film(2): recommended rank 2 = 1.0/(60+2) only
    // film(3) should be boosted above film(2)
    const idx3 = result.findIndex((f) => f.tmdb_id === 3);
    const idx2 = result.findIndex((f) => f.tmdb_id === 2);
    expect(idx3).toBeLessThan(idx2);
  });

  it("handles empty lists gracefully", () => {
    const result = applyRRF([
      { name: "recommended", items: [film(1)] as any },
      { name: "collaborative", items: [] as any },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.tmdb_id).toBe(1);
  });

  it("prefers richer metadata when merging duplicates", () => {
    const result = applyRRF([
      { name: "recommended", items: [film(1, { film_id: "f1", photo_url: "/img.jpg" })] as any },
      { name: "collaborative", items: [film(1)] as any },
    ]);

    expect(result[0]!.film_id).toBe("f1");
  });
});
