import { GoogleGenAI } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";


const EMBEDDING_MODEL = "gemini-embedding-001";
const DIMENSION = 768;


function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env variable ${name} (check backend/.env)`);
  }
  return value;
}


async function embed(ai: GoogleGenAI, text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: DIMENSION },
  });

  // `embeddings` y `values` pueden ser undefined según los tipos del SDK.
  // El `?.` significa "si existe, sigue; si no, devuelve undefined".
  const values = response.embeddings?.[0]?.values;
  if (!values) {
    throw new Error("Gemini no devolvió ningún embedding");
  }
  return values;
}

async function main(): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  const pinecone = new Pinecone({ apiKey: requireEnv("PINECONE_API_KEY") });
  const index = pinecone.index({ name: requireEnv("PINECONE_INDEX") });

  // 1) Embedding
  const text = "Full refund within 30 days with receipt. No refunds on digital goods.";
  const vector = await embed(ai, text);
  console.log(`Embedding OK: ${vector.length} dimensiones`);

  // 2) Upsert: Store the embedding in Pinecone. The ID is arbitrary, but must be unique.
  await index.upsert({
    records: [
      {
        id: "smoke-test#chunk-1",
        values: vector,
        metadata: { docId: "smoke-test", title: "Smoke Test", chunkText: text },
      },
    ],
  });
  console.log("Upsert OK");

 
  await new Promise((resolve) => setTimeout(resolve, 5000));

  
  const questionVector = await embed(ai, "Can I get a refund on a digital product?");
  const result = await index.query({
    vector: questionVector,
    topK: 3,
    includeMetadata: true,
  });

  console.log(`Query OK: ${result.matches.length} resultado(s)`);
  for (const match of result.matches) {
    console.log(`  ${match.id}  score=${match.score?.toFixed(3)}`);
  }
}


main().catch((error: unknown) => {
  console.error("Falló el smoke test:", error);
  process.exit(1);
});
