import { jest, describe, it, expect, beforeEach } from "@jest/globals";

jest.unstable_mockModule("../service/clickhouse/clickhouseService.js", () => ({
  insertInteractionEvents: jest.fn(),
  insertImpressionEvent: jest.fn(),
}));

const { selectBookmarkFilms, bookmarkFilm, removeBookmark } = await import("../service/bookmark/bookmarkService.js");
const { insertInteractionEvents } = await import("../service/clickhouse/clickhouseService.js");

const mockFrom = jest.fn();
const supabaseClient = { from: mockFrom } as any;
const userId = "user-bk" as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("selectBookmarkFilms", () => {
  it("returns paginated bookmarks", async () => {
    const bookmarks = [{ film_id: 1 }, { film_id: 2 }];
    const range = jest.fn().mockResolvedValue({ data: bookmarks, error: null });
    const eq = jest.fn().mockReturnValue({ range });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const result = await selectBookmarkFilms({ supabaseClient, userId, page: 1 });

    expect(mockFrom).toHaveBeenCalledWith("Bookmarks");
    expect(result).toEqual(bookmarks);
  });

  it("throws on query error", async () => {
    const range = jest.fn().mockResolvedValue({ data: null, error: { message: "db err" } });
    const eq = jest.fn().mockReturnValue({ range });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    await expect(selectBookmarkFilms({ supabaseClient, userId, page: 1 })).rejects.toThrow("Failed to fetch bookmarked films");
  });
});

describe("bookmarkFilm", () => {
  it("inserts bookmark and logs analytics", async () => {
    const insertFn = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: insertFn });

    await bookmarkFilm({
      supabaseClient,
      userId,
      tmdbId: 42,
      title: "My Drama",
      genre: ["drama"],
    });

    expect(insertFn).toHaveBeenCalledWith({
      user_id: userId,
      film_id: 42,
      title: "My Drama",
      genre: ["drama"],
    });
    expect(insertInteractionEvents).toHaveBeenCalledWith({
      userId, tmdbId: 42, interactionType: "bookmark", film_name: "My Drama", rating: 0,
    });
  });

  it("throws on insert error", async () => {
    const insertFn = jest.fn().mockResolvedValue({ error: { message: "dup" } });
    mockFrom.mockReturnValue({ insert: insertFn });

    await expect(
      bookmarkFilm({ supabaseClient, userId, tmdbId: 42, title: "X", genre: [] })
    ).rejects.toThrow("Failed to bookmark film");
  });
});

describe("removeBookmark", () => {
  it("deletes bookmark by user and film id", async () => {
    const eqFilm = jest.fn().mockResolvedValue({ error: null });
    const eqUser = jest.fn().mockReturnValue({ eq: eqFilm });
    const deleteFn = jest.fn().mockReturnValue({ eq: eqUser });
    mockFrom.mockReturnValue({ delete: deleteFn });

    await removeBookmark({ supabaseClient, userId, tmdbId: 42 });

    expect(mockFrom).toHaveBeenCalledWith("Bookmarks");
  });

  it("throws on delete error", async () => {
    const eqFilm = jest.fn().mockResolvedValue({ error: { message: "fail" } });
    const eqUser = jest.fn().mockReturnValue({ eq: eqFilm });
    const deleteFn = jest.fn().mockReturnValue({ eq: eqUser });
    mockFrom.mockReturnValue({ delete: deleteFn });

    await expect(removeBookmark({ supabaseClient, userId, tmdbId: 42 })).rejects.toThrow("Failed to remove bookmark");
  });
});
