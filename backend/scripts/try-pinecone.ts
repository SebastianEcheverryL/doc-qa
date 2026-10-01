// Throwaway check that PineconeStore works against the real index.
// Run with: npm run try-pinecone
// Uses the docId "try-pinecone" and cleans up after itself. Also removes the
// leftover "smoke-test" vector from the Phase 0 smoke test.

import { loadConfig } from "../src/config";
import { GeminiEmbeddings } from "../src/providers/gemini";
import { PineconeStore } from "../src/providers/pinecone";
import type { VectorRecord } from "../src/providers/types";

const DOC_ID = "try-pinecone";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const config = loadConfig();
  const embeddings = new GeminiEmbeddings(config.geminiApiKey, config.embeddingModel, config.embeddingDimension);
  const store = new PineconeStore(config.pineconeApiKey, config.pineconeIndex);

  const makeRecords = async (texts: string[]): Promise<VectorRecord[]> => {
    const vectors = await embeddings.embed(texts, "document");
    return texts.map((text, i) => ({
      id: `${DOC_ID}#chunk-${i + 1}`,
      values: vectors[i] ?? [],
      metadata: { docId: DOC_ID, title: "Try Pinecone", chunkText: text },
    }));
  };

  const [questionVector] = await embeddings.embed(["Can I get a refund on a digital product?"], "query");
  if (!questionVector) throw new Error("no query vector");
  const countOurs = async (): Promise<string[]> => {
    const matches = await store.query(questionVector, 10);
    return matches.filter((m) => m.metadata.docId === DOC_ID).map((m) => m.id);
  };

  console.log("1) upsert 3 chunks");
  await store.upsert(
    await makeRecords([
      "Full refund within 30 days with receipt. No refunds on digital goods.",
      "Shipping takes 2 to 5 business days.",
      "Support is available Monday to Friday.",
    ])
  );
  await wait(10000);
  console.log("   chunks found by query:", await countOurs());

  console.log("2) re-ingest with only 1 chunk (deleteByDoc + upsert)");
  await store.deleteByDoc(DOC_ID);
  await store.upsert(await makeRecords(["Full refund within 30 days. Digital goods are not refundable."]));
  await wait(10000);
  console.log("   chunks found by query:", await countOurs(), "(expected only chunk-1)");

  console.log("3) cleanup");
  await store.deleteByDoc(DOC_ID);
  await store.deleteByDoc("smoke-test");
  await wait(10000);
  const left = (await store.query(questionVector, 10)).map((m) => m.id);
  console.log("   matches left in index:", left);
}

main().catch((error: unknown) => {
  console.error("try-pinecone failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
