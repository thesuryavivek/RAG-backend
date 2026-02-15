import type { Request, Response } from "express";
import { query } from "../services/queryService.js";

export const queryController = async (req: Request, res: Response) => {
  const result = await query(req.body.question);
  if (result.success) {
    res.status(201).json(result.answer);
  } else {
    res.status(500).json({ error: result.error });
  }
};
