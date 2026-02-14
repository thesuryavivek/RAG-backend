import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import * as z from "zod";
import { cleanData } from "./utils.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const DataSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("note"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("url"),
    url: z.url(),
  }),
]);

export type DataSource = z.infer<typeof DataSourceSchema>;
const dataSources: DataSource[] = [];

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server is running!");
});

app.get("/items", (req: Request, res: Response) => {
  res.json({
    dataSources,
  });
});

app.post("/ingest", async (req: Request, res: Response) => {
  const result = DataSourceSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  const data = result.data;

  const cleanedData = await cleanData(data);
  console.log(cleanedData);

  dataSources.push(data);
  res.status(201).json({ success: true, data });
});

app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});
