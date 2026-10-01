export interface Config {
  geminiApiKey: string;
  pineconeApiKey: string;
  pineconeIndex: string;
  embeddingModel: string;
  embeddingDimension: number;
  llmModel: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env variable ${name} (check backend/.env)`);
  }
  return value;
}
function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export function loadConfig(): Config {
  return {
    geminiApiKey: requireEnv('GEMINI_API_KEY'),
    pineconeApiKey: requireEnv('PINECONE_API_KEY'),
    pineconeIndex: requireEnv('PINECONE_INDEX'),
    embeddingModel: optionalEnv('EMBEDDING_MODEL', 'gemini-embedding-2'),
    embeddingDimension: Number(optionalEnv('EMBEDDING_DIMENSION', '768')),
    llmModel: optionalEnv('LLM_MODEL', 'gemini-2.5-flash')
  };
}