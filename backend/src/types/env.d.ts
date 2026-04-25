declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    NODE_ENV?: 'development' | 'production' | 'test';
    CORS_ORIGIN?: string;
    LLM_PROVIDER?: 'ollama' | 'llamacpp';
    OLLAMA_BASE_URL?: string;
    OLLAMA_MODEL?: string;
    OLLAMA_EMBED_MODEL?: string;
    OLLAMA_NUM_GPU?: string;
    LLAMA_CPP_BASE_URL?: string;
    REDIS_URL?: string;
    REDIS_KEY_PREFIX?: string;
    RECENT_MEMORY_LIMIT?: string;
    RAG_TOP_K?: string;
    RAG_MIN_SCORE?: string;
    VECTOR_STORE_FILE?: string;
    STRATEGY_STORE_FILE?: string;
    PROMPT_MEMORY_LIMIT?: string;
    PROMPT_MEMORY_CHAR_LIMIT?: string;
    PROMPT_CHUNK_CHAR_LIMIT?: string;
  }
}
