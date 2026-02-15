import type { Request, Response } from "express";
import { ingestSource } from "../services/ingestService.js";

export const ingestController = async (req: Request, res: Response) => {
  const result = await ingestSource(req.body);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(500).json({ error: result.error });
  }
};
