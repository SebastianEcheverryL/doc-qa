import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VectorRecord } from "../src/providers/types";

// The Pinecone SDK is replaced by a fake index so these tests never touch the network.
const { index } = vi.hoisted(() => ({
  index: { upsert: vi.fn(), query: vi.fn(), listPaginated: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: class {
    index() {
      return index;
    }
  },
}));

import { PineconeStore } from "../src/providers/pinecone";

const store = new PineconeStore("key", "doc-qa");

const record = (n: number): VectorRecord => ({
  id: `doc#chunk-${n}`,
  values: [n],
  metadata: { docId: "doc", title: "Doc", chunkText: `text ${n}` },
});

beforeEach(() => {
  Object.values(index).forEach((fn) => fn.mockReset());
});

describe("PineconeStore.upsert", () => {
  it("does not call Pinecone when there are no records", async () => {
    await store.upsert([]);
    expect(index.upsert).not.toHaveBeenCalled();
  });

  it("sends the records in batches of 100", async () => {
    await store.upsert(Array.from({ length: 250 }, (_, i) => record(i)));
    expect(index.upsert.mock.calls.map(([params]) => params.records.length)).toEqual([100, 100, 50]);
  });

  it("sends the id, vector and metadata untouched", async () => {
    await store.upsert([record(1)]);
    expect(index.upsert).toHaveBeenCalledWith({ records: [record(1)] });
  });
});

describe("PineconeStore.query", () => {
  const match = (overrides: Record<string, unknown> = {}) => ({
    id: "doc#chunk-1",
    score: 0.9,
    metadata: { docId: "doc", title: "Doc", chunkText: "text" },
    ...overrides,
  });

  it("asks Pinecone for the topK closest vectors with their metadata", async () => {
    index.query.mockResolvedValue({ matches: [] });
    await store.query([0.1, 0.2], 4);
    expect(index.query).toHaveBeenCalledWith({ vector: [0.1, 0.2], topK: 4, includeMetadata: true });
  });

  it("maps every match to id, score and metadata", async () => {
    index.query.mockResolvedValue({ matches: [match()] });
    expect(await store.query([1], 3)).toEqual([
      { id: "doc#chunk-1", score: 0.9, metadata: { docId: "doc", title: "Doc", chunkText: "text" } },
    ]);
  });

  it("drops matches without a score", async () => {
    index.query.mockResolvedValue({ matches: [match({ score: undefined })] });
    expect(await store.query([1], 3)).toEqual([]);
  });

  it("drops matches without metadata", async () => {
    index.query.mockResolvedValue({ matches: [match({ metadata: undefined })] });
    expect(await store.query([1], 3)).toEqual([]);
  });

  it.each(["docId", "title", "chunkText"])("drops matches whose %s is not a string", async (field) => {
    index.query.mockResolvedValue({
      matches: [match({ metadata: { docId: "doc", title: "Doc", chunkText: "text", [field]: 42 } })],
    });
    expect(await store.query([1], 3)).toEqual([]);
  });

  it("keeps the valid matches when others are dropped", async () => {
    index.query.mockResolvedValue({ matches: [match({ id: "a", score: undefined }), match({ id: "b" })] });
    expect((await store.query([1], 3)).map((m) => m.id)).toEqual(["b"]);
  });
});

describe("PineconeStore.deleteByDoc", () => {
  const page = (ids: (string | undefined)[], next?: string) => ({
    vectors: ids.map((id) => ({ id })),
    pagination: next ? { next } : undefined,
  });

  it("lists only the chunks of that document, so 'refund' never matches 'refund-policy'", async () => {
    index.listPaginated.mockResolvedValue(page([]));
    await store.deleteByDoc("refund");
    expect(index.listPaginated).toHaveBeenCalledWith({ prefix: "refund#chunk-", paginationToken: undefined });
  });

  it("follows the pagination token until there are no more pages", async () => {
    index.listPaginated
      .mockResolvedValueOnce(page(["doc#chunk-1", "doc#chunk-2"], "token-2"))
      .mockResolvedValueOnce(page(["doc#chunk-3"]));

    await store.deleteByDoc("doc");

    expect(index.listPaginated.mock.calls.map(([params]) => params.paginationToken)).toEqual([undefined, "token-2"]);
    expect(index.deleteMany).toHaveBeenCalledWith({ ids: ["doc#chunk-1", "doc#chunk-2", "doc#chunk-3"] });
  });

  it("ignores listed vectors that have no id", async () => {
    index.listPaginated.mockResolvedValue(page(["doc#chunk-1", undefined]));
    await store.deleteByDoc("doc");
    expect(index.deleteMany).toHaveBeenCalledWith({ ids: ["doc#chunk-1"] });
  });

  it("does not call deleteMany when the document has no chunks", async () => {
    index.listPaginated.mockResolvedValue({});
    await store.deleteByDoc("doc");
    expect(index.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes in batches of 1000 ids", async () => {
    const ids = Array.from({ length: 2500 }, (_, i) => `doc#chunk-${i}`);
    index.listPaginated.mockResolvedValue(page(ids));

    await store.deleteByDoc("doc");

    expect(index.deleteMany.mock.calls.map(([params]) => params.ids.length)).toEqual([1000, 1000, 500]);
  });
});
