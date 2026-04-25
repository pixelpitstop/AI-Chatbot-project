declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    NODE_ENV?: 'development' | 'production' | 'test';
    CORS_ORIGIN?: string;
    OLLAMA_BASE_URL?: string;
    OLLAMA_MODEL?: string;
    OLLAMA_EMBED_MODEL?: string;
    REDIS_URL?: string;
    REDIS_KEY_PREFIX?: string;
    RECENT_MEMORY_LIMIT?: string;
    RAG_TOP_K?: string;
    VECTOR_STORE_FILE?: string;
  }
}
