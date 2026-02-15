import { openai } from "./openaiClient.js";

export const embed = async (data: string[] | string) => {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: data,
  });

  const embeddings = res.data.map((i) => i.embedding);
  return embeddings;
};
