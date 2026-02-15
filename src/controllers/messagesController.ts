import type { Request, Response } from "express";
import { messagesService } from "../services/messagesService.js";

export const messagesController = async (req: Request, res: Response) => {
  const result = await messagesService();
  if (result.success) {
    res.status(201).json(result.messages);
  } else {
    res.status(500).json({ error: result.error });
  }
};
