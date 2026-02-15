import { prisma } from "../db/prisma.js";

export const sourceService = async () => {
  try {
    const sources = await prisma.source.findMany({
      orderBy: {
        createdAt: "asc",
      },
    });

    return {
      success: true,
      sources,
    };
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
