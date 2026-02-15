import type { ingestDatatype } from "../schemas/ingestSchema.js";
import { chromaClient } from "./chromaClient.js";
import { chunkByTokens, cleanData } from "./chunkerService.js";
import { embed } from "./embeddingService.js";

export const ingestSource = async (data: ingestDatatype) => {
  try {
    const cleanedData = await cleanData(data);

    if (!cleanedData) {
      throw new Error("no clean data");
    }

    const chunks = chunkByTokens(cleanedData);
    const embeddings = await embed(chunks);

    const collection = await chromaClient.getOrCreateCollection({
      name: "rag_collection",
    });

    await collection.add({
      ids: chunks.map((c, i) => `${Date.now()}_chunk_${i}`),
      documents: chunks,
      embeddings,
      metadatas: chunks.map(() => ({
        timestamp: new Date().toISOString(),
        source_type: data.type,
      })),
    });

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    } else {
      return {
        success: false,
        error: "Something went wrong, please try again",
      };
    }
  }
};
