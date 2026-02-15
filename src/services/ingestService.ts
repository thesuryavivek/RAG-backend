import { v4 as uuid } from "uuid";
import { chromaClient } from "../db/chroma.js";
import { prisma } from "../db/prisma.js";
import type { ingestDatatype } from "../schemas/ingestSchema.js";
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
      ids: chunks.map((c) => uuid()),
      documents: chunks,
      embeddings,
      metadatas: chunks.map(() => ({
        timestamp: new Date().toISOString(),
        source_type: data.type,
      })),
    });

    await prisma.source.create({
      data: {
        type: data.type,
        rawText: cleanedData,
        sourceUrl: data.type === "url" ? data.url : null,
      },
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
