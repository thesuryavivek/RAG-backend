import type { Request, Response } from "express";
import { sourceService } from "../services/sourceService.js";

export const sourceController = async (req: Request, res: Response) => {
  const result = await sourceService();
  if (result.success) {
    res.status(201).json(result.sources);
  } else {
    res.status(500).json({ error: result.error });
  }
};
