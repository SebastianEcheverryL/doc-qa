export interface Config {
  geminiApiKey: string;
  pineconeApiKey: string;
  pineconeIndex: string;
  embeddingModel: string;
  embeddingDimension: number;
  llmModel: string;
  /** Minimum similarity score (0 to 1) for a chunk to be used to answer. */
  minScore: number;
}

type Env = Record<string, string | undefined>;

function requireEnv(env: Env, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing env variable ${name} (check backend/.env)`);
  }
  return value;
}

function optionalEnv(env: Env, name: string, fallback: string): string {
  return env[name] || fallback;
}

function numberEnv(env: Env, name: string, fallback: string): number {
  const raw = optionalEnv(env, name, fallback);
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Env variable ${name} must be a number, got "${raw}"`);
  }
  return value;
}

export function loadConfig(env: Env = process.env): Config {
  const embeddingDimension = numberEnv(env, "EMBEDDING_DIMENSION", "768");
  if (!Number.isInteger(embeddingDimension) || embeddingDimension <= 0) {
    throw new Error("Env variable EMBEDDING_DIMENSION must be a positive integer");
  }

  const minScore = numberEnv(env, "MIN_SCORE", "0.65");
  if (minScore < 0 || minScore > 1) {
    throw new Error("Env variable MIN_SCORE must be between 0 and 1");
  }

  return {
    geminiApiKey: requireEnv(env, "GEMINI_API_KEY"),
    pineconeApiKey: requireEnv(env, "PINECONE_API_KEY"),
    pineconeIndex: requireEnv(env, "PINECONE_INDEX"),
    embeddingModel: optionalEnv(env, "EMBEDDING_MODEL", "gemini-embedding-001"),
    embeddingDimension,
    llmModel: optionalEnv(env, "LLM_MODEL", "gemini-3.8-flash"),
    minScore,
  };
}
