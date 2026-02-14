import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import * as z from "zod";
import { chromaClient } from "./services/chromaClient.js";
import { chunkByTokens, cleanData, embed } from "./utils.js";

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

  if (!cleanedData) {
    res.status(400).json({ error: "url is not good" });
    return;
  }

  const chunks = chunkByTokens(cleanedData);
  console.log("chunks created", Date.now());

  const embeddings = await embed(chunks);
  console.log("embeddings created", Date.now());

  const collection = await chromaClient.getOrCreateCollection({
    name: "rag_collection",
  });
  console.log("collection created", Date.now());

  await collection.add({
    ids: chunks.map((c, i) => `${Date.now()}_chunk_${i}`),
    documents: chunks,
    embeddings,
    metadatas: chunks.map(() => ({
      timestamp: new Date().toISOString(),
      source_type: data.type,
    })),
  });

  console.log("chunks added", Date.now());

  dataSources.push(data);
  res.status(201).json({ success: true, data });
});

app.post("/query", async (req: Request, res: Response) => {
  const question = req.body.question;

  console.log("question is", question);

  const questionEmbedding = await embed(question);

  const collection = await chromaClient.getCollection({
    name: "rag_collection",
  });

  const results = await collection.query({
    queryEmbeddings: questionEmbedding,
    nResults: 5,
    include: ["documents", "metadatas"],
  });
  
  const context = results.documents.map((doc, index) => `SOURCE ${index + 1} \n ${doc} \n`).join('\n')
  
  const completions = await openai.responses.create({
    model: 'gpt-5-nano',
    input: [
      {
        role: 'developer'
      }
    ]
  })

});

app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});
