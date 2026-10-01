// Throwaway end-to-end check of ingest + ask with the real providers.
// Run with: npm run try-rag
// Ingests demo documents (ids prefixed "rag-demo-"), prints the raw scores so the
// minimum-score threshold can be tuned, asks a few questions, then cleans up.

import { loadConfig } from "../src/config";
import { AskService } from "../src/core/askService";
import { IngestService } from "../src/core/ingestService";
import { GeminiEmbeddings, GeminiLLM } from "../src/providers/gemini";
import { PineconeStore } from "../src/providers/pinecone";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const documents = [
  { id: "rag-demo-refund-policy", title: "Refund Policy", content: "Full refund within 30 days with receipt. No refunds on digital goods." },
  { id: "rag-demo-shipping", title: "Shipping", content: "Orders ship within 2 business days. Standard delivery takes 3 to 5 days. Express delivery takes 1 to 2 days and costs 15 USD." },
  { id: "rag-demo-support", title: "Support Hours", content: "Customer support is available Monday to Friday from 9am to 6pm UTC. Weekend support is not available." },
];

const questions = [
  "Can I get a refund on a digital product?",
  "How long does express delivery take?",
  "When is support open?",
  "What is the capital of France?",
  "How do I cook pasta?",
];

async function main(): Promise<void> {
  const config = loadConfig();
  const embeddings = new GeminiEmbeddings(config.geminiApiKey, config.embeddingModel, config.embeddingDimension);
  const store = new PineconeStore(config.pineconeApiKey, config.pineconeIndex);
  const llm = new GeminiLLM(config.geminiApiKey, config.llmModel);
  const ingest = new IngestService(embeddings, store);
  const ask = new AskService(embeddings, store, llm);

  try {
    console.log("== ingest");
    console.log(await ingest.ingest(documents));
    await wait(10000); // Pinecone is eventually consistent

    for (const question of questions) {
      console.log(`\n== ${question}`);

      const [vector] = await embeddings.embed([question], "query");
      if (!vector) throw new Error("no query vector");
      const raw = await store.query(vector, 3);
      console.log("   raw scores:", raw.map((m) => `${m.metadata.docId.replace("rag-demo-", "")}=${m.score.toFixed(3)}`).join("  "));

      const result = await ask.ask(question, 3);
      console.log("   answer :", result.answer);
      console.log("   sources:", result.sources.map((s) => `${s.docId} (${s.title})`));
    }
  } finally {
    console.log("\n== cleanup");
    for (const doc of documents) await store.deleteByDoc(doc.id);
  }
}

main().catch((error: unknown) => {
  console.error("try-rag failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
