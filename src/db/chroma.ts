import { ChromaClient } from 'chromadb';
import dotenv from 'dotenv';
dotenv.config();

export const chromaClient = new ChromaClient({
  host: process.env.CHROMA_HOST || 'localhost',
  port: Number(process.env.CHROMA_PORT || 8000),
});
