// Throwaway check that GeminiEmbeddings and GeminiLLM work against the real API.
// Run with: npm run try-gemini

import { loadConfig } from "../src/config";
import { GeminiEmbeddings, GeminiLLM } from "../src/providers/gemini";

async function main(): Promise<void> {
  const config = loadConfig();

  const embeddings = new GeminiEmbeddings(config.geminiApiKey, config.embeddingModel, config.embeddingDimension);
  const vectors = await embeddings.embed(["hello", "world"], "document");
  console.log(`embed OK: ${vectors.length} vectors, ${vectors[0]?.length} dimensions`);
  console.log("empty input:", await embeddings.embed([], "document"));

  const llm = new GeminiLLM(config.geminiApiKey, config.llmModel);
  const answer = await llm.generate("Say hello in one short sentence.");
  console.log(`generate OK (${config.llmModel}): ${answer}`);
}

main().catch((error: unknown) => {
  console.error("try-gemini failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
