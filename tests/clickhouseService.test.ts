import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockInsert = jest.fn<(...args: any[]) => any>();

jest.unstable_mockModule("@clickhouse/client", () => ({
  createClient: () => ({
    insert: mockInsert,
  }),
}));

const { insertInteractionEvents, insertImpressionEvent } = await import("../service/clickhouse/clickhouseService.js");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("insertInteractionEvents", () => {
  it("inserts an interaction row with timestamp into clickhouse", async () => {
    mockInsert.mockResolvedValueOnce(undefined);

    await insertInteractionEvents({
      userId: "u1",
      tmdbId: 42,
      interactionType: "like",
      rating: 0,
      genre_ids: [18],
      film_name: "Drama X",
    });

    expect(mockInsert).toHaveBeenCalledWith({
      table: "interactions",
      values: [
        expect.objectContaining({
          user_id: "u1",
          tmdb_id: 42,
          interaction_type: "like",
          rating: 0,
          genre_ids: [18],
          film_name: "Drama X",
          created_at: expect.any(Date),
        }),
      ],
      format: "JSONEachRow",
    });
  });

  it("propagates clickhouse errors", async () => {
    mockInsert.mockRejectedValueOnce(new Error("connection refused"));

    await expect(
      insertInteractionEvents({
        userId: "u1",
        tmdbId: 1,
        interactionType: "rating",
        rating: 5,
      })
    ).rejects.toThrow("connection refused");
  });
});

describe("insertImpressionEvent", () => {
  it("inserts an impression row with timestamp into clickhouse", async () => {
    mockInsert.mockResolvedValueOnce(undefined);

    await insertImpressionEvent({
      userId: "u1",
      tmdbId: 42,
      sessionId: "sess-1",
      position: 3,
      surface: "feed",
      genre_ids: [18],
      film_name: "Drama Y",
      embedding_similarity: 0.85,
      genre_overlap: 0.5,
    });

    expect(mockInsert).toHaveBeenCalledWith({
      table: "impressions",
      values: [
        expect.objectContaining({
          user_id: "u1",
          tmdb_id: 42,
          session_id: "sess-1",
          position: 3,
          surface: "feed",
          genre_ids: [18],
          film_name: "Drama Y",
          embedding_similarity: 0.85,
          genre_overlap: 0.5,
          created_at: expect.any(Date),
        }),
      ],
      format: "JSONEachRow",
    });
  });

  it("defaults similarity fields to 0 when not provided", async () => {
    mockInsert.mockResolvedValueOnce(undefined);

    await insertImpressionEvent({
      userId: "u1",
      tmdbId: 42,
      sessionId: "sess-1",
      position: 0,
      surface: "feed",
      genre_ids: [],
      film_name: "Drama Z",
    });

    expect(mockInsert).toHaveBeenCalledWith({
      table: "impressions",
      values: [
        expect.objectContaining({
          embedding_similarity: 0,
          genre_overlap: 0,
        }),
      ],
      format: "JSONEachRow",
    });
  });
});
