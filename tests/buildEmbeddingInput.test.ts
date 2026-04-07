import { describe, it, expect } from "@jest/globals";
import { buildFilmEmbeddingInput } from "../etl/buildEmbeddingInput.js";

describe("buildFilmEmbeddingInput", () => {
  it("builds full input string with all fields", () => {
    const result = buildFilmEmbeddingInput({
      tmdb_id: 1,
      title: "Squid Game",
      overview: "A survival drama",
      genre_ids: [18, 53],
      release_year: "2021",
      media_type: "tv",
    });

    expect(result).toBe(
      "Title: Squid Game. Overview: A survival drama. Genres: [18, 53]. Year: 2021. Type: tv.",
    );
  });

  it("handles missing overview", () => {
    const result = buildFilmEmbeddingInput({
      tmdb_id: 2,
      title: "Parasite",
      genre_ids: [35, 18],
      release_year: "2019",
      media_type: "movie",
    });

    expect(result).toBe("Title: Parasite. Genres: [35, 18]. Year: 2019. Type: movie.");
    expect(result).not.toContain("Overview");
  });

  it("handles missing title with fallback to Unknown", () => {
    const result = buildFilmEmbeddingInput({ tmdb_id: 3 });

    expect(result).toBe("Title: Unknown.");
  });

  it("handles empty genre_ids array", () => {
    const result = buildFilmEmbeddingInput({
      tmdb_id: 4,
      title: "Test",
      genre_ids: [],
    });

    expect(result).toBe("Title: Test.");
    expect(result).not.toContain("Genres");
  });

  it("handles all fields missing except tmdb_id", () => {
    const result = buildFilmEmbeddingInput({ tmdb_id: 5 });

    expect(result).toBe("Title: Unknown.");
  });
});
