import { prisma } from '../db/prisma.js';
import { logger } from './logger.js';

export const sourceService = async () => {
  try {
    const sources = await prisma.source.findMany({
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      success: true,
      sources,
    };
  } catch (err) {
    logger.error({ err }, 'Failed to fetch sources');
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
