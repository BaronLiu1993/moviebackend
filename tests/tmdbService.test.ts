const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import { fetchTmdbOverview, fetchTmdbKeywords } from "../service/tmdb/tmdbService.js";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("fetchTmdbOverview", () => {
  it("returns TV data when TV endpoint succeeds", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ name: "Squid Game", overview: "A survival drama" }),
    });

    const result = await fetchTmdbOverview(1234);

    expect(result).toEqual({ title: "Squid Game", overview: "A survival drama" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]![0]).toContain("/3/tv/1234");
  });

  it("falls back to movie endpoint when TV fails", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ title: "Parasite", overview: "A dark comedy" }),
      });

    const result = await fetchTmdbOverview(5678);

    expect(result).toEqual({ title: "Parasite", overview: "A dark comedy" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1]![0]).toContain("/3/movie/5678");
  });

  it("throws when both endpoints fail", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false });

    await expect(fetchTmdbOverview(9999)).rejects.toThrow("TMDB details not found for ID 9999");
  });

  it("handles missing fields gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ original_name: "Korean Title" }),
    });

    const result = await fetchTmdbOverview(111);

    expect(result).toEqual({ title: "Korean Title", overview: "" });
  });
});

describe("fetchTmdbKeywords", () => {
  it("returns TV keywords when available", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [{ id: 1, name: "revenge" }, { id: 2, name: "family" }] }),
    });

    const result = await fetchTmdbKeywords(1234);

    expect(result).toEqual(["revenge", "family"]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to movie keywords when TV has none", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keywords: [{ id: 3, name: "thriller" }] }),
      });

    const result = await fetchTmdbKeywords(5678);

    expect(result).toEqual(["thriller"]);
  });

  it("throws when no keywords found from either endpoint", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false });

    await expect(fetchTmdbKeywords(9999)).rejects.toThrow("TMDB keywords not found for ID 9999");
  });
});
