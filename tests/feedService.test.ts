import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type AnyFn = (...args: any[]) => any;

const mockFetch = jest.fn<AnyFn>();
global.fetch = mockFetch as any;

const mockRedisGet = jest.fn<AnyFn>();
const mockRedisSet = jest.fn<AnyFn>();

jest.unstable_mockModule("../queue/redis/redis.js", () => ({
  Connection: { get: mockRedisGet, set: mockRedisSet },
}));

const {
  getInitialFeed,
  getAiringDramas,
  getPopularDramas,
  getCollaborativeFilters,
  applyRRF,
  deduplicateCollaborative,
} = await import("../service/feed/feedService.js");

const mockFrom = jest.fn<AnyFn>();
const mockRpc = jest.fn<AnyFn>();
const supabaseClient = { from: mockFrom, rpc: mockRpc } as any;
const userId = "user-feed" as any;

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper: mock a full cache miss computation (RPCs + TMDB)
const setupCacheMissMocks = () => {
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue("OK");

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
};

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
  it("computes and caches on cache miss", async () => {
    setupCacheMissMocks();

    const result = await getInitialFeed({ supabaseClient, userId, page: 1, pageSize: 20 });

    expect(mockRedisGet).toHaveBeenCalled();
    expect(mockRedisSet).toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalled();
    expect(result.films.length).toBeGreaterThan(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(typeof result.hasMore).toBe("boolean");
  });

  it("returns cached results without RPCs on cache hit", async () => {
    const cachedFilms = [
      { tmdb_id: 1, title: "Cached Film 1", release_year: "2024", genre_ids: [18] },
      { tmdb_id: 2, title: "Cached Film 2", release_year: "2024", genre_ids: [35] },
      { tmdb_id: 3, title: "Cached Film 3", release_year: "2024", genre_ids: [18] },
    ];
    mockRedisGet.mockResolvedValue(JSON.stringify(cachedFilms));

    const result = await getInitialFeed({ supabaseClient, userId, page: 1, pageSize: 2 });

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.films).toHaveLength(2);
    expect(result.films[0]!.tmdb_id).toBe(1);
    expect(result.hasMore).toBe(true);
  });

  it("paginates from cache correctly", async () => {
    const cachedFilms = Array.from({ length: 5 }, (_, i) => ({
      tmdb_id: i + 1, title: `Film ${i + 1}`, release_year: "2024", genre_ids: [18],
    }));
    mockRedisGet.mockResolvedValue(JSON.stringify(cachedFilms));

    const page2 = await getInitialFeed({ supabaseClient, userId, page: 2, pageSize: 2 });

    expect(page2.films).toHaveLength(2);
    expect(page2.films[0]!.tmdb_id).toBe(3);
    expect(page2.films[1]!.tmdb_id).toBe(4);
    expect(page2.hasMore).toBe(true);

    const page3 = await getInitialFeed({ supabaseClient, userId, page: 3, pageSize: 2 });

    expect(page3.films).toHaveLength(1);
    expect(page3.films[0]!.tmdb_id).toBe(5);
    expect(page3.hasMore).toBe(false);
  });

  it("falls back to computation on Redis read failure", async () => {
    mockRedisGet.mockRejectedValue(new Error("Redis down"));
    mockRedisSet.mockResolvedValue("OK");

    const recommended = [{ tmdb_id: 1, title: "F1", release_year: "2024", film_id: "f1", genre_ids: [18], similarity: 0.9, photo_url: null, media_type: "tv" }];
    mockRpc
      .mockResolvedValueOnce({ data: recommended, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) });

    const result = await getInitialFeed({ supabaseClient, userId, page: 1, pageSize: 20 });

    expect(result.films.length).toBeGreaterThan(0);
    expect(mockRpc).toHaveBeenCalled();
  });
});

describe("deduplicateCollaborative", () => {
  it("aggregates duplicate films by average rating", () => {
    const films = [
      { tmdb_id: 1, rating: 4, film_name: "Drama A", genre_ids: [18] },
      { tmdb_id: 1, rating: 5, film_name: "Drama A", genre_ids: [18] },
      { tmdb_id: 2, rating: 4, film_name: "Drama B", genre_ids: [35] },
    ];

    const result = deduplicateCollaborative(films);

    expect(result).toHaveLength(2);
    expect(result[0]!.tmdb_id).toBe(1);
    expect(result[0]!.rating).toBe(4.5);
    expect(result[1]!.tmdb_id).toBe(2);
    expect(result[1]!.rating).toBe(4);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateCollaborative([])).toEqual([]);
  });

  it("sorts by average rating descending", () => {
    const films = [
      { tmdb_id: 1, rating: 4, film_name: "A", genre_ids: [] },
      { tmdb_id: 2, rating: 5, film_name: "B", genre_ids: [] },
    ];

    const result = deduplicateCollaborative(films);

    expect(result[0]!.tmdb_id).toBe(2);
    expect(result[1]!.tmdb_id).toBe(1);
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

    expect(result[0]!.tmdb_id).toBe(1);
    expect(result.find((f) => f.tmdb_id === 4)).toBeTruthy();
  });

  it("boosts items appearing in multiple lists", () => {
    const result = applyRRF([
      { name: "recommended", items: [film(1), film(2), film(3)] as any },
      { name: "collaborative", items: [film(3), film(4)] as any },
    ]);

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
