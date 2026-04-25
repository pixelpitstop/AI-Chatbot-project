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

## Current Backend Status

- Express server scaffolded
- Health endpoint available at `GET /health`
- Local LLM service wired to Ollama via `GET /llm/test`
- Redis-backed recent memory module added
- Chat route available at `POST /chat` (JSON + SSE streaming)
- Document indexing route available at `POST /documents/add`
- Document retrieval route available at `GET /documents/search`

## Backend API Notes

- Ollama base URL defaults to `http://localhost:11434`
- Ollama model defaults to `llama3`
- Ollama embedding model defaults to `nomic-embed-text`
- Test the local model connection with `GET /llm/test`

## RAG Notes

- Documents are chunked, embedded locally, and stored in a cosine-similarity index
- Vector data persists to `backend/data/vector-store.json` by default
- Chat now injects top-k retrieved context snippets before generation

## Memory Notes

- Recent chat memory will be stored in Redis
- Default Redis URL is `redis://localhost:6379`
- Recent memory keeps the latest 12 messages by default

## Runtime Notes

- Backend lives in `backend/`
- Copy `backend/.env.example` to `backend/.env`
- Default backend port: `3001`
- Default frontend port: `3000`
