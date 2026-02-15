import { prisma } from "../db/prisma.js";

export const messagesService = async () => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: {
        createdAt: "asc",
      },
    });

    return {
      success: true,
      messages,
    };
  } catch (err) {
    console.log(err);
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
