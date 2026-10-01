import { chunkDocument } from "./chunking";
import type { Document } from "./types";
import type { EmbeddingProvider, VectorRecord, VectorStore } from "../providers/types";

export interface IngestResult {
  ingestedDocuments: number;
  ingestedChunks: number;
}

export class IngestService {
  constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly store: VectorStore
  ) {}

  async ingest(documents: Document[]): Promise<IngestResult> {
    let ingestedChunks = 0;

    for (const doc of documents) {
      const chunks = chunkDocument(doc);

      const vectors = await this.embeddings.embed(
        chunks.map((c) => c.text),
        "document"
      );
      if (vectors.length !== chunks.length) {
        throw new Error(`Expected ${chunks.length} vectors, got ${vectors.length}`);
      }

      const records: VectorRecord[] = chunks.map((chunk, i) => {
        const vector = vectors[i];
        if (!vector) throw new Error(`Missing vector for chunk ${chunk.id}`);
        return {
          id: chunk.id,
          values: vector,
          metadata: { docId: chunk.docId, title: chunk.title, chunkText: chunk.text },
        };
      });

      await this.store.deleteByDoc(doc.id);
      await this.store.upsert(records);
      ingestedChunks += records.length;
    }

    return { ingestedDocuments: documents.length, ingestedChunks };
  }
}
