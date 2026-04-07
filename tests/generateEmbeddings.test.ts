import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type AnyFn = (...args: any[]) => any;

const mockCreate = jest.fn<AnyFn>();

jest.unstable_mockModule("openai", () => ({
  default: class {
    embeddings = { create: mockCreate };
  },
}));

const { generateFilmEmbeddings } = await import("../etl/generateEmbeddings.js");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateFilmEmbeddings", () => {
  it("returns embeddings in input order", async () => {
    const embedding1 = Array(1536).fill(0.1);
    const embedding2 = Array(1536).fill(0.2);

    mockCreate.mockResolvedValueOnce({
      data: [
        { index: 1, embedding: embedding2 },
        { index: 0, embedding: embedding1 },
      ],
    });

    const result = await generateFilmEmbeddings(["film one", "film two"]);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(embedding1);
    expect(result[1]).toBe(embedding2);
    expect(mockCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: ["film one", "film two"],
      encoding_format: "float",
    });
  });

  it("returns empty array for empty input", async () => {
    const result = await generateFilmEmbeddings([]);

    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
