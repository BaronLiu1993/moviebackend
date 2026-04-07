import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const generateFilmEmbeddings = async (
  inputs: string[],
): Promise<number[][]> => {
  if (inputs.length === 0) return [];

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: inputs,
    encoding_format: "float",
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
};
