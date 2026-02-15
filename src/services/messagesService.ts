import { prisma } from '../db/prisma.js';
import { logger } from './logger.js';

export const messagesService = async () => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        citations: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            snippet: true,
            citationIndex: true,
            source: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      messages,
    };
  } catch (err) {
    logger.error({ err }, 'Failed to fetch messages');
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
