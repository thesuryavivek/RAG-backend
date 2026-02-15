import { chromaClient } from '../db/chroma.js';
import { prisma } from '../db/prisma.js';
import { embed } from './embeddingService.js';
import { logger } from './logger.js';
import { openai } from './openaiClient.js';

export const query = async (question: string) => {
  try {
    const createdMessage = await prisma.message.create({
      data: {
        question,
      },
    });

    const questionEmbedding = await embed(question);

    const collection = await chromaClient.getCollection({
      name: 'rag_collection',
    });

    const results = await collection.query({
      queryEmbeddings: questionEmbedding,
      nResults: 5,
      include: ['documents', 'metadatas'],
    });

    const metas = results.metadatas[0];

    const context = results.documents[0]
      ?.map((doc, index) => {
        const meta = metas?.[index];
        return `SOURCE ${index + 1}: ${meta?.url || meta?.title} \n ${doc} \n`;
      })
      .join('\n\n');

    const response = await openai.responses.create({
      model: 'gpt-5-nano',
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text:
                'You are a RAG assistant. Answer ONLY using the sources provided. ' +
                "If the answer is not present in the sources, say you don't know.",
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Question: ${question} \n\n Sources: \n ${context}`,
            },
          ],
        },
      ],
    });

    const citations = results.metadatas[0]
      ?.map((metadata, index) => ({
        sourceId: metadata?.source_id as string,
        snippet: results.documents?.[0]?.[index]?.slice(0, 300) || '',
        citationIndex: index + 1,
      }))
      .filter((citation) => citation.sourceId);

    await prisma.message.update({
      data: {
        answer: response.output_text,
        citations: {
          createMany: {
            data: citations || [],
          },
        },
      },
      where: {
        id: createdMessage.id,
      },
    });

    logger.info(
      { messageId: createdMessage.id, sources: results.documents[0]?.length },
      'Query completed',
    );

    return {
      success: true,
      answer: response.output_text,
    };
  } catch (err) {
    logger.error({ err, question }, 'Query failed');
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
