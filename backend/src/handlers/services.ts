import { loadConfig } from "../config";
import { AskService } from "../core/askService";
import { IngestService } from "../core/ingestService";
import { GeminiEmbeddings, GeminiLLM } from "../providers/gemini";
import { PineconeStore } from "../providers/pinecone";

export interface Services {
  ingest: IngestService;
  ask: AskService;
}

let cached: Services | undefined;

/**
 * Builds the services the first time it is called and reuses them afterwards.
 * It is lazy on purpose: a missing env variable then fails inside the handler (a controlled 500)
 * instead of crashing the Lambda while it starts, and importing the handlers needs no configuration.
 */
export function getServices(): Services {
  if (cached) return cached;

  const config = loadConfig();

  const embeddings = new GeminiEmbeddings(config.geminiApiKey, config.embeddingModel, config.embeddingDimension);
  const store = new PineconeStore(config.pineconeApiKey, config.pineconeIndex);
  const llm = new GeminiLLM(config.geminiApiKey, config.llmModel);

  cached = {
    ingest: new IngestService(embeddings, store),
    ask: new AskService(embeddings, store, llm, config.minScore),
  };

  return cached;
}
