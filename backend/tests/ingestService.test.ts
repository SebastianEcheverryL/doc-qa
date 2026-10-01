import { describe, it, expect } from "vitest";
import { IngestService } from "../src/core/ingestService";
import type { EmbeddingProvider, EmbedKind, VectorMatch, VectorRecord, VectorStore } from "../src/providers/types";

// Fakes: they implement the provider interfaces and record what they receive,
// so the service can be tested without network, API keys or quota.

class FakeEmbeddings implements EmbeddingProvider {
  calls: { texts: string[]; kind: EmbedKind }[] = [];

  async embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
    this.calls.push({ texts, kind });
    return texts.map((_, i) => [i, i + 1, i + 2]);
  }
}

class FakeStore implements VectorStore {
  log: string[] = [];
  upserted: VectorRecord[][] = [];

  async upsert(records: VectorRecord[]): Promise<void> {
    this.log.push("upsert");
    this.upserted.push(records);
  }

  async query(): Promise<VectorMatch[]> {
    return [];
  }

  async deleteByDoc(docId: string): Promise<void> {
    this.log.push(`delete:${docId}`);
  }
}

// Two paragraphs of 500 chars do not fit together in one 800-char chunk -> 2 chunks.
const twoChunkContent = `${"a".repeat(500)}\n\n${"b".repeat(500)}`;

const setup = () => {
  const embeddings = new FakeEmbeddings();
  const store = new FakeStore();
  return { embeddings, store, service: new IngestService(embeddings, store) };
};

describe("IngestService.ingest", () => {
  it("returns the number of documents and chunks ingested", async () => {
    const { service } = setup();
    const result = await service.ingest([
      { id: "long", title: "Long", content: twoChunkContent },
      { id: "short", title: "Short", content: "just one chunk" },
    ]);
    expect(result).toEqual({ ingestedDocuments: 2, ingestedChunks: 3 });
  });

  it("upserts one record per chunk with id, vector and metadata", async () => {
    const { service, store } = setup();
    await service.ingest([{ id: "refund-policy", title: "Refund Policy", content: "No refunds on digital goods." }]);

    expect(store.upserted).toEqual([
      [
        {
          id: "refund-policy#chunk-1",
          values: [0, 1, 2],
          metadata: { docId: "refund-policy", title: "Refund Policy", chunkText: "No refunds on digital goods." },
        },
      ],
    ]);
  });

  it("embeds chunks as documents, all chunks of a document in one call", async () => {
    const { service, embeddings } = setup();
    await service.ingest([{ id: "long", title: "Long", content: twoChunkContent }]);

    expect(embeddings.calls).toHaveLength(1);
    expect(embeddings.calls[0]?.kind).toBe("document");
    expect(embeddings.calls[0]?.texts).toHaveLength(2);
  });

  it("deletes the old chunks of a document before upserting the new ones", async () => {
    const { service, store } = setup();
    await service.ingest([{ id: "doc", title: "Doc", content: "hello" }]);
    expect(store.log).toEqual(["delete:doc", "upsert"]);
  });

  it("still deletes old chunks when the new content is empty", async () => {
    const { service, store, embeddings } = setup();
    const result = await service.ingest([{ id: "doc", title: "Doc", content: "   " }]);

    expect(store.log[0]).toBe("delete:doc");
    expect(store.upserted.flat()).toEqual([]);
    expect(embeddings.calls[0]?.texts).toEqual([]);
    expect(result.ingestedChunks).toBe(0);
  });

  it("does not delete or upsert anything when embedding fails", async () => {
    const store = new FakeStore();
    const failing: EmbeddingProvider = {
      embed: async () => {
        throw new Error("embedding quota exceeded");
      },
    };
    const service = new IngestService(failing, store);

    await expect(service.ingest([{ id: "doc", title: "Doc", content: "hello" }])).rejects.toThrow(
      "embedding quota exceeded"
    );
    expect(store.log).toEqual([]);
  });

  it("throws before touching the store when the provider returns the wrong number of vectors", async () => {
    const store = new FakeStore();
    const broken: EmbeddingProvider = { embed: async () => [] };
    const service = new IngestService(broken, store);

    await expect(service.ingest([{ id: "doc", title: "Doc", content: "hello" }])).rejects.toThrow(
      "Expected 1 vectors, got 0"
    );
    expect(store.log).toEqual([]);
  });
});
