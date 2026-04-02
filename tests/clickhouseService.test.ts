const mockInsert = jest.fn();

jest.mock("@clickhouse/client", () => ({
  createClient: () => ({
    insert: mockInsert,
  }),
}));

import { insertInteractionEvents, insertImpressionEvent } from "../service/clickhouse/clickhouseService.js";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("insertInteractionEvents", () => {
  it("inserts an interaction row into clickhouse", async () => {
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
        {
          user_id: "u1",
          tmdb_id: 42,
          interaction_type: "like",
          rating: 0,
          genre_ids: [18],
          film_name: "Drama X",
        },
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
  it("inserts an impression row into clickhouse", async () => {
    mockInsert.mockResolvedValueOnce(undefined);

    await insertImpressionEvent({
      userId: "u1",
      tmdbId: 42,
      sessionId: "sess-1",
      position: 3,
      surface: "feed",
      genre_ids: [18],
      film_name: "Drama Y",
    });

    expect(mockInsert).toHaveBeenCalledWith({
      table: "impressions",
      values: [
        {
          user_id: "u1",
          tmdb_id: 42,
          session_id: "sess-1",
          position: 3,
          surface: "feed",
          genre_ids: [18],
          film_name: "Drama Y",
        },
      ],
      format: "JSONEachRow",
    });
  });
});
