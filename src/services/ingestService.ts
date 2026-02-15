import { v4 as uuid } from 'uuid';
import { chromaClient } from '../db/chroma.js';
import { prisma } from '../db/prisma.js';
import type { ingestDatatype } from '../schemas/ingestSchema.js';
import { chunkByTokens, cleanData } from './chunkerService.js';
import { embed } from './embeddingService.js';
import { logger } from './logger.js';

export const ingestSource = async (data: ingestDatatype) => {
  try {
    const cleanedData = await cleanData(data);

    if (!cleanedData) {
      throw new Error('no clean data');
    }

    const source = await prisma.source.create({
      data: {
        type: data.type,
        rawText: cleanedData,
        sourceUrl: data.type === 'url' ? data.url : null,
        title: data.title,
      },
    });

    const chunks = chunkByTokens(cleanedData);
    const embeddings = await embed(chunks);

    const collection = await chromaClient.getOrCreateCollection({
      name: 'rag_collection',
      embeddingFunction: null,
    });

    await collection.add({
      ids: chunks.map((c) => uuid()),
      documents: chunks,
      embeddings,
      metadatas: chunks.map((c, i) => ({
        chunk_index: i,
        timestamp: new Date().toISOString(),
        source_type: source.type,
        source_id: source.id,
        url: source.type === 'url' ? source.sourceUrl : null,
        title: source.title,
      })),
    });

    logger.info(
      { sourceId: source.id, type: data.type, chunks: chunks.length },
      'Source ingested',
    );

    return { success: true };
  } catch (err) {
    logger.error({ err, type: data.type }, 'Ingestion failed');
    if (err instanceof Error) {
      return { success: false, error: err.message };
    } else {
      return {
        success: false,
        error: 'Something went wrong, please try again',
      };
    }
  }
};
