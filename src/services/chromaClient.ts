import { ChromaClient } from "chromadb";

export const chromaClient = new ChromaClient({
  host: "chromadb",
  port: 8000,
});
