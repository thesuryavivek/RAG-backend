# Backend

A RAG (Retrieval-Augmented Generation) backend that ingests URLs and notes, chunks and embeds them, and answers questions using relevant retrieved context.

## Architecture

```
User Query → Embed → ChromaDB similarity search → Top-5 chunks → GPT-5-nano → Answer + Citations
```

```
URL/Note → Clean & Extract → Chunk (500 tokens) → Embed → Store in ChromaDB + SQLite
```

### Stack

| Layer        | Choice                          |
| ------------ | ------------------------------- |
| Runtime      | Node.js + Express               |
| Language     | TypeScript                      |
| LLM          | GPT-5-nano (OpenAI)             |
| Embeddings   | text-embedding-3-small (OpenAI) |
| Vector Store | ChromaDB                        |
| Database     | SQLite (via Prisma)             |
| Logging      | Pino + pino-http                |

### URL Fetching (3-Tier Strategy)

Not all websites serve content to plain HTTP requests. The backend uses a tiered fallback:

1. **Plain `fetch()` + Readability** — fast, zero overhead. Works for Wikipedia, blogs, docs sites.
2. **Puppeteer + Stealth Plugin** — launches a headless Chromium that bypasses Cloudflare Turnstile and similar bot detection. Handles SPAs and JS-rendered content.
3. **Jina Reader API** (`r.jina.ai`) — external service, last resort for sites with aggressive bot protection.

Each tier only runs if the previous one fails to extract content.

## Local Development Setup

### Prerequisites

- Node.js v24+
- pnpm v10+
- Docker (for ChromaDB)
- An OpenAI API key

### 1. Clone & Install

```bash
git clone <repo-url>
cd backend
pnpm install
```

When prompted by `pnpm approve-builds`, select `puppeteer` and approve — this downloads Chromium for the stealth browser fetcher.

### 2. Environment Variables

Create a `.env` file in the project root:

```env
OPEN_AI_API_KEY=your-openai-api-key

DATABASE_URL="file:./dev.db"

# Leave these unset for local dev (defaults to localhost:8000)
# CHROMA_HOST=localhost
# CHROMA_PORT=8000

NODE_ENV=development
```

### 3. Start ChromaDB

```bash
docker run -d -p 8000:8000 --name chromadb chromadb/chroma
```

Verify it's running:

```bash
curl http://localhost:8000/api/v1/heartbeat
```

### 4. Setup Database

Generate the Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

This creates `dev.db` (SQLite) in the project root and generates the typed client at `src/generated/prisma/`.

### 5. Start the Dev Server

```bash
pnpm run dev
```

The server starts on `http://localhost:3000` with hot-reload via tsx.

### Docker (Production)

```bash
docker compose up --build -d
```

## API Endpoints

| Method | Endpoint    | Body                                                | Description       |
| ------ | ----------- | --------------------------------------------------- | ----------------- |
| POST   | `/ingest`   | `{ "type": "url", "title": "...", "url": "..." }`   | Ingest a URL      |
| POST   | `/ingest`   | `{ "type": "note", "title": "...", "text": "..." }` | Ingest a note     |
| POST   | `/query`    | `{ "question": "..." }`                             | Ask a question    |
| GET    | `/items`    | —                                                   | List all sources  |
| GET    | `/messages` | —                                                   | List all messages |

### Quick Test

```bash
# Ingest a Wikipedia page
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -d '{"type": "url", "title": "Express", "url": "https://en.wikipedia.org/wiki/Express.js"}'

# Ask a question
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is Express.js?"}'
```

## Project Structure

```
src/
├── controllers/       # Route handlers
├── db/
│   ├── chroma.ts      # ChromaDB client
│   └── prisma.ts      # Prisma client
├── middleware/
│   └── validate.ts    # Zod request validation
├── schemas/           # Zod schemas
├── services/
│   ├── logger.ts      # Pino logger
│   ├── chunkerService.ts   # URL fetching, text extraction, tokenization
│   ├── embeddingService.ts # OpenAI embeddings
│   ├── ingestService.ts    # Ingestion pipeline
│   ├── queryService.ts     # RAG query pipeline
│   ├── messagesService.ts  # Message history
│   └── sourceService.ts    # Source listing
└── index.ts           # Express app entry point
```

## Troubleshooting

**ChromaDB connection error** — Make sure the ChromaDB container is running (`docker ps`). The backend expects it at `localhost:8000` by default.

**Puppeteer crash** — If Chromium fails to launch, install system dependencies:

```bash
# Ubuntu/Debian
sudo apt install -y chromium-browser
```

Then set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` in your `.env`.

**Prisma client not found** — Run `npx prisma generate` to regenerate the typed client.

## Design Decisions & Tradeoffs

### 1. Chunking Approach

**Choice:** Fixed-size token chunking (500 tokens, 80 token overlap) using tiktoken.

**Why:** Token-based chunking guarantees each chunk fits within the embedding model's context window and produces consistent embedding quality. The 80-token overlap ensures sentences split across chunk boundaries still appear in at least one chunk, reducing information loss at boundaries.

**Tradeoff:** Semantic-aware chunking (splitting on paragraphs, headings, or using an LLM to find topic boundaries) would produce more coherent chunks, but adds complexity and latency. For a general-purpose ingestion pipeline that handles everything from Wikipedia to npm READMEs, fixed-size chunking is predictable and fast.

### 2. Vector Store Choice

**Choice:** ChromaDB.

**Why:** ChromaDB is simple to self-host, has a straightforward API, and runs as a single Docker container with no external dependencies. For a project that stores embeddings from personal notes and bookmarked URLs, it's the right level of infrastructure.

**Tradeoff:** ChromaDB stores everything in-memory by default and isn't built for distributed workloads. At scale, Pinecone, Weaviate, or pgvector (if already running Postgres) would be better choices. ChromaDB also lacks built-in filtering by similarity threshold - we always get back exactly `nResults` regardless of relevance.

### 3. What Breaks at Scale

- **SQLite** - single-writer lock means concurrent ingestion requests will queue. Fine for personal use, blocks under multi-user load.
- **ChromaDB** - no horizontal scaling. Memory-bound. Large collections (100k+ chunks) will slow down queries.
- **Puppeteer** - each stealth browser fetch launches a full Chromium process (~200MB RAM). Under concurrent ingestion, this will exhaust server memory quickly. Needs a browser pool or queue.
- **No ingestion queue** - URLs are fetched and processed synchronously in the request handler. A slow website blocks the HTTP response. Should be moved to a background job (BullMQ, etc).
- **Embedding cost** - every ingestion and query calls OpenAI. At volume, costs add up and rate limits become a concern.

### 4. Production Changes

- **Swap SQLite → Postgres** - handles concurrent writes, proper connection pooling, battle-tested at scale.
- **Add a job queue** - BullMQ or similar for async ingestion. Return a job ID immediately, process in the background.
- **Browser pool** - reuse Chromium instances across fetches instead of launching/closing per request. Libraries like `generic-pool` work well.
- **Similarity threshold** - filter out low-relevance chunks before sending to the LLM. ChromaDB returns distances; reject chunks below a threshold to improve answer quality.
- **Caching** - cache embeddings for repeated queries, cache fetched URL content with a TTL.
- **Rate limiting** - protect the ingestion and query endpoints from abuse.
- **Auth** - currently wide open. Add API keys or JWT for multi-user deployments.
