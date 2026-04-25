# AI MUN Research Assistant

Production-grade local LLM assistant for MUN research, strategy tracking, and retrieval-augmented argument generation.

## Progress

- Step 1: Backend initialization completed
- Step 2: Ollama integration completed
- Step 3: Redis memory completed
- Step 4: Chat route completed
- Step 5: Streaming responses completed
- Step 6: Vector store + embeddings completed
- Step 7: RAG integrated into chat completed
- Step 8: Structured strategy memory completed
- Step 9: Argument generator completed
- Step 10: Frontend completed
- Step 11: Backend optimization completed

## Current Backend Status

- Express server scaffolded
- Health endpoint available at `GET /health`
- Local LLM service supports provider switch (Ollama or llama.cpp) via `GET /llm/test`
- Redis-backed recent memory module added
- Chat route available at `POST /chat` (JSON + SSE streaming)
- Document indexing route available at `POST /documents/add`
- Document retrieval route available at `GET /documents/search`
- Strategy memory update route available at `POST /strategy/update`
- Strategy memory read route available at `GET /strategy`
- Argument generation route available at `POST /argument/generate`
- Memory clear route available at `POST /memory/clear`

## Backend API Notes

- `LLM_PROVIDER` supports `ollama` (default) or `llamacpp`
- llama.cpp base URL defaults to `http://127.0.0.1:8081`
- Ollama base URL defaults to `http://localhost:11434`
- Ollama model defaults to `llama3`
- Ollama embedding model defaults to `nomic-embed-text`
- Test the local model connection with `GET /llm/test`

## RAG Notes

- Documents are chunked, embedded locally, and stored in a cosine-similarity index
- Vector data persists to `backend/data/vector-store.json` by default
- Chat now injects top-k retrieved context snippets before generation
- Retrieval filters low-similarity chunks using `RAG_MIN_SCORE`
- Retrieval de-duplicates results by document for cleaner context
- If embedding generation is unavailable, retrieval falls back to no-context mode instead of failing chat

## Optimization Notes

- Chat prompt uses a smaller sliding memory window for local model speed
- Prompt chunk and memory text are capped with char limits to reduce context size

## Memory Notes

- Recent chat memory will be stored in Redis
- Default Redis URL is `redis://localhost:6379`
- Recent memory keeps the latest 12 messages by default
- Structured strategy memory persists in `backend/data/strategy-memory.json`

## Runtime Notes

- Backend lives in `backend/`
- Copy `backend/.env.example` to `backend/.env`
- Default backend port: `3001`
- Default frontend port: `3000`

## Frontend Notes

- Frontend lives in `frontend/` (Next.js App Router + Tailwind)
- Set `NEXT_PUBLIC_API_BASE_URL` to your backend URL if not using `http://localhost:3001`
- Includes chat UI, strategy panel, argument generator, and memory clear control
- Chat uses streaming mode via SSE over `POST /chat`

## Local Run

1. Start Redis and your selected local LLM runtime.
2. For Ollama mode, keep `LLM_PROVIDER=ollama` and start Ollama.
3. For llama.cpp mode, set `LLM_PROVIDER=llamacpp` and run llama-server on `http://127.0.0.1:8081`.
4. In `backend/`: `npm install`, then `npm run dev`.
5. In `frontend/`: `npm install`, then `npm run dev`.
6. Open `http://localhost:3000`.
