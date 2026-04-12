import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type AnyFn = (...args: any[]) => any;

jest.unstable_mockModule("../queue/redis/redis.js", () => ({
  Connection: { on: jest.fn<AnyFn>() },
}));

jest.unstable_mockModule("../service/clickhouse/clickhouseService.js", () => ({
  insertInteractionEvents: jest.fn<AnyFn>(),
  insertImpressionEvent: jest.fn<AnyFn>(),
}));

jest.unstable_mockModule("../queue/updateEmbedding/updateEmbeddingQueue.js", () => ({
  default: { add: jest.fn<AnyFn>() },
}));

const { insertInteractionEvents } = await import("../service/clickhouse/clickhouseService.js");
const { default: updateEmbeddingQueue } = await import("../queue/updateEmbedding/updateEmbeddingQueue.js");
const { selectRatings, insertRating, deleteRating, updateRating } = await import("../service/rate/rateService.js");

const mockFrom = jest.fn<AnyFn>();
const supabaseClient = { from: mockFrom } as any;

const userId = "user-123" as any;
const accessToken = "token-abc";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("selectRatings", () => {
  it("returns ratings ordered by created_at desc", async () => {
    const ratings = [{ rating_id: "r1", rating: 5 }];
    const order = jest.fn<AnyFn>().mockResolvedValue({ data: ratings, error: null });
    const eq = jest.fn<AnyFn>().mockReturnValue({ order });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const result = await selectRatings({ userId, supabaseClient });

    expect(mockFrom).toHaveBeenCalledWith("Ratings");
    expect(result).toEqual(ratings);
  });

  it("throws on select error", async () => {
    const order = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { message: "db error" } });
    const eq = jest.fn<AnyFn>().mockReturnValue({ order });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    await expect(selectRatings({ userId, supabaseClient })).rejects.toThrow("Failed to select ratings");
  });
});

describe("insertRating", () => {
  const baseArgs = {
    supabaseClient,
    rating: 4,
    note: "Great drama",
    userId,
    tmdbId: 12345,
    name: "My Drama",
    genre_ids: [18, 10759],
    accessToken,
  };

  it("inserts rating and enqueues embedding job", async () => {
    // 1. Check existing rating — not found
    const singleCheck = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const eqTmdb = jest.fn<AnyFn>().mockReturnValue({ single: singleCheck });
    const eqUser = jest.fn<AnyFn>().mockReturnValue({ eq: eqTmdb });
    const selectCheck = jest.fn<AnyFn>().mockReturnValue({ eq: eqUser });

    // 2. Fetch photo_url from Guanghai
    const singlePhoto = jest.fn<AnyFn>().mockResolvedValue({ data: { photo_url: "https://image.tmdb.org/t/p/w500/poster.jpg" }, error: null });
    const eqPhoto = jest.fn<AnyFn>().mockReturnValue({ single: singlePhoto });
    const selectPhoto = jest.fn<AnyFn>().mockReturnValue({ eq: eqPhoto });

    // 3. Insert rating — returns rating_id
    const singleInsert = jest.fn<AnyFn>().mockResolvedValue({ data: { rating_id: "r1" }, error: null });
    const selectInsert = jest.fn<AnyFn>().mockReturnValue({ single: singleInsert });
    const insertFn = jest.fn<AnyFn>().mockReturnValue({ select: selectInsert });

    mockFrom
      .mockReturnValueOnce({ select: selectCheck })
      .mockReturnValueOnce({ select: selectPhoto })
      .mockReturnValueOnce({ insert: insertFn });

    await insertRating(baseArgs);

    expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({
      user_id: userId,
      rating: 4,
      tmdb_id: 12345,
      image_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
    }));
    expect(insertInteractionEvents).toHaveBeenCalledWith({
      userId, tmdbId: 12345, interactionType: "rating", rating: 4, film_name: "My Drama", genre_ids: [18, 10759],
    });
    expect(updateEmbeddingQueue.add).toHaveBeenCalledWith("recompute", {
      userId, accessToken, operation: "insert", tmdbId: 12345, rating: 4,
    });
  });

  it("throws if user already rated the film", async () => {
    const singleCheck = jest.fn<AnyFn>().mockResolvedValue({ data: { rating_id: "existing" }, error: null });
    const eqTmdb = jest.fn<AnyFn>().mockReturnValue({ single: singleCheck });
    const eqUser = jest.fn<AnyFn>().mockReturnValue({ eq: eqTmdb });
    const selectCheck = jest.fn<AnyFn>().mockReturnValue({ eq: eqUser });
    mockFrom.mockReturnValueOnce({ select: selectCheck });

    await expect(insertRating(baseArgs)).rejects.toThrow("User has already rated this film");
  });

  it("throws on insert error", async () => {
    const singleCheck = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const eqTmdb = jest.fn<AnyFn>().mockReturnValue({ single: singleCheck });
    const eqUser = jest.fn<AnyFn>().mockReturnValue({ eq: eqTmdb });
    const selectCheck = jest.fn<AnyFn>().mockReturnValue({ eq: eqUser });

    // Guanghai photo_url fetch
    const singlePhoto = jest.fn<AnyFn>().mockResolvedValue({ data: { photo_url: null }, error: null });
    const eqPhoto = jest.fn<AnyFn>().mockReturnValue({ single: singlePhoto });
    const selectPhoto = jest.fn<AnyFn>().mockReturnValue({ eq: eqPhoto });

    // Insert fails
    const singleInsert = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { message: "constraint violation" } });
    const selectInsert = jest.fn<AnyFn>().mockReturnValue({ single: singleInsert });
    const insertFn = jest.fn<AnyFn>().mockReturnValue({ select: selectInsert });

    mockFrom
      .mockReturnValueOnce({ select: selectCheck })
      .mockReturnValueOnce({ select: selectPhoto })
      .mockReturnValueOnce({ insert: insertFn });

    await expect(insertRating(baseArgs)).rejects.toThrow("Failed to insert rating");
  });
});

describe("deleteRating", () => {
  const ratingId = "rating-456" as any;

  it("deletes rating and enqueues embedding job", async () => {
    const singleFetch = jest.fn<AnyFn>().mockResolvedValue({
      data: { user_id: userId, tmdb_id: 999, rating: 3 },
      error: null,
    });
    const eqFetch = jest.fn<AnyFn>().mockReturnValue({ single: singleFetch });
    const selectFetch = jest.fn<AnyFn>().mockReturnValue({ eq: eqFetch });

    const eqDelete = jest.fn<AnyFn>().mockResolvedValue({ error: null });
    const deleteFn = jest.fn<AnyFn>().mockReturnValue({ eq: eqDelete });

    mockFrom
      .mockReturnValueOnce({ select: selectFetch })
      .mockReturnValueOnce({ delete: deleteFn });

    await deleteRating({ ratingId, userId, supabaseClient, accessToken });

    expect(insertInteractionEvents).toHaveBeenCalledWith({ userId, tmdbId: 999, interactionType: "rating", rating: 0 });
    expect(updateEmbeddingQueue.add).toHaveBeenCalledWith("recompute", {
      userId, accessToken, operation: "delete", tmdbId: 999, rating: 3,
    });
  });

  it("throws if rating not found", async () => {
    const singleFetch = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { message: "not found" } });
    const eqFetch = jest.fn<AnyFn>().mockReturnValue({ single: singleFetch });
    const selectFetch = jest.fn<AnyFn>().mockReturnValue({ eq: eqFetch });
    mockFrom.mockReturnValueOnce({ select: selectFetch });

    await expect(deleteRating({ ratingId, userId, supabaseClient, accessToken })).rejects.toThrow("Rating not found");
  });

  it("throws if user is unauthorized", async () => {
    const singleFetch = jest.fn<AnyFn>().mockResolvedValue({
      data: { user_id: "other-user", tmdb_id: 999, rating: 3 },
      error: null,
    });
    const eqFetch = jest.fn<AnyFn>().mockReturnValue({ single: singleFetch });
    const selectFetch = jest.fn<AnyFn>().mockReturnValue({ eq: eqFetch });
    mockFrom.mockReturnValueOnce({ select: selectFetch });

    await expect(deleteRating({ ratingId, userId, supabaseClient, accessToken })).rejects.toThrow("Unauthorized");
  });
});

describe("updateRating", () => {
  const ratingId = "rating-789" as any;

  it("updates rating and enqueues embedding job with old rating", async () => {
    const singleFetch = jest.fn<AnyFn>().mockResolvedValue({
      data: { user_id: userId, tmdb_id: 555, rating: 2 },
      error: null,
    });
    const eqFetch = jest.fn<AnyFn>().mockReturnValue({ single: singleFetch });
    const selectFetch = jest.fn<AnyFn>().mockReturnValue({ eq: eqFetch });

    const eqUpdate = jest.fn<AnyFn>().mockResolvedValue({ error: null });
    const updateFn = jest.fn<AnyFn>().mockReturnValue({ eq: eqUpdate });

    mockFrom
      .mockReturnValueOnce({ select: selectFetch })
      .mockReturnValueOnce({ update: updateFn });

    await updateRating({
      ratingId, userId, newRating: 5, newNote: "Updated note", supabaseClient, accessToken,
    });

    expect(updateFn).toHaveBeenCalledWith({ rating: 5, note: "Updated note" });
    expect(insertInteractionEvents).toHaveBeenCalledWith({ userId, tmdbId: 555, interactionType: "rating", rating: 5 });
    expect(updateEmbeddingQueue.add).toHaveBeenCalledWith("recompute", {
      userId, accessToken, operation: "update", tmdbId: 555, rating: 5, oldRating: 2,
    });
  });

  it("throws if rating not found", async () => {
    const singleFetch = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { message: "not found" } });
    const eqFetch = jest.fn<AnyFn>().mockReturnValue({ single: singleFetch });
    const selectFetch = jest.fn<AnyFn>().mockReturnValue({ eq: eqFetch });
    mockFrom.mockReturnValueOnce({ select: selectFetch });

    await expect(
      updateRating({ ratingId, userId, newRating: 5, newNote: "x", supabaseClient, accessToken })
    ).rejects.toThrow("Rating not found");
  });
});
