import { chromaClient } from '../db/chroma.js';
import { prisma } from '../db/prisma.js';
import { embed } from './embeddingService.js';
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

    const context = results.documents
      .map((doc, index) => `SOURCE ${index + 1} \n ${doc} \n`)
      .join('\n');

    const response = await openai.responses.create({
      model: 'gpt-5-nano',
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: "You are a RAG assistant. Answer ONLY using the provided sources. If the answer is not present, just say you don't know.",
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
      ?.map((metadata) => ({ sourceId: metadata?.source_id as string }))
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

    return {
      success: true,
      answer: response.output_text,
    };
  } catch (err) {
    console.log(err);
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
