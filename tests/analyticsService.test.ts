jest.mock("../service/clickhouse/clickhouseService.js", () => ({
  insertInteractionEvents: jest.fn(),
  insertImpressionEvent: jest.fn(),
}));

import { handleLike, handleRating, handleBookmark } from "../service/analytics/analyticsService.js";
import { insertInteractionEvents } from "../service/clickhouse/clickhouseService.js";

const userId = "user-abc" as any;
const tmdbId = 42;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("handleLike", () => {
  it("inserts a like interaction event", async () => {
    await handleLike({ userId, tmdbId, film_name: "Drama A", genre_ids: [18] });

    expect(insertInteractionEvents).toHaveBeenCalledWith({
      userId,
      tmdbId,
      interactionType: "like",
      film_name: "Drama A",
      genre_ids: [18],
      rating: 0,
    });
  });

  it("does not throw when insertInteractionEvents fails", async () => {
    (insertInteractionEvents as jest.Mock).mockRejectedValueOnce(new Error("clickhouse down"));

    await expect(handleLike({ userId, tmdbId })).resolves.toBeUndefined();
  });
});

describe("handleRating", () => {
  it("inserts a rating interaction event", async () => {
    await handleRating({ userId, tmdbId, rating: 5, film_name: "Drama B", genre_ids: [35] });

    expect(insertInteractionEvents).toHaveBeenCalledWith({
      userId,
      tmdbId,
      interactionType: "rating",
      rating: 5,
      film_name: "Drama B",
      genre_ids: [35],
    });
  });

  it("swallows errors gracefully", async () => {
    (insertInteractionEvents as jest.Mock).mockRejectedValueOnce(new Error("timeout"));

    await expect(handleRating({ userId, tmdbId, rating: 3 })).resolves.toBeUndefined();
  });
});

describe("handleBookmark", () => {
  it("inserts a bookmark interaction event", async () => {
    await handleBookmark({ userId, tmdbId, film_name: "Drama C", genre_ids: [10759] });

    expect(insertInteractionEvents).toHaveBeenCalledWith({
      userId,
      tmdbId,
      interactionType: "bookmark",
      film_name: "Drama C",
      genre_ids: [10759],
      rating: 0,
    });
  });
});
