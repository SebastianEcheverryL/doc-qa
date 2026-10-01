import { describe, it, expect } from "vitest";
import { AskService, NO_INFO_ANSWER } from "../src/core/askService";
import type {
  EmbeddingProvider,
  EmbedKind,
  LLMProvider,
  VectorMatch,
  VectorRecord,
  VectorStore,
} from "../src/providers/types";

// Fakes that implement the provider interfaces and record what they receive.

class FakeEmbeddings implements EmbeddingProvider {
  calls: { texts: string[]; kind: EmbedKind }[] = [];

  async embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
    this.calls.push({ texts, kind });
    return texts.map(() => [0.1, 0.2, 0.3]);
  }
}

class FakeStore implements VectorStore {
  queries: { vector: number[]; topK: number }[] = [];

  constructor(private readonly matches: VectorMatch[]) {}

  async upsert(_records: VectorRecord[]): Promise<void> {}

  async query(vector: number[], topK: number): Promise<VectorMatch[]> {
    this.queries.push({ vector, topK });
    return this.matches;
  }

  async deleteByDoc(_docId: string): Promise<void> {}
}

class FakeLLM implements LLMProvider {
  prompts: string[] = [];

  constructor(private readonly reply = "Digital products are not eligible for refunds.") {}

  async generate(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    return this.reply;
  }
}

const match = (id: string, docId: string, title: string, chunkText: string, score: number): VectorMatch => ({
  id,
  score,
  metadata: { docId, title, chunkText },
});

const refund1 = match("refund-policy#chunk-1", "refund-policy", "Refund Policy", "No refunds on digital goods.", 0.9);
const refund2 = match("refund-policy#chunk-2", "refund-policy", "Refund Policy", "Refunds take 5 days.", 0.8);
const shipping = match("shipping#chunk-1", "shipping", "Shipping", "Orders ship in 2 days.", 0.7);
const unrelated = match("cooking#chunk-1", "cooking", "Cooking", "Boil pasta for 10 minutes.", 0.2);

const setup = (matches: VectorMatch[], minScore?: number) => {
  const embeddings = new FakeEmbeddings();
  const store = new FakeStore(matches);
  const llm = new FakeLLM();
  return { embeddings, store, llm, service: new AskService(embeddings, store, llm, minScore) };
};

describe("AskService.ask", () => {
  it("answers with the LLM reply and the sources of the retrieved documents", async () => {
    const { service } = setup([refund1]);
    const result = await service.ask("Can I get a refund on a digital product?", 3);

    expect(result).toEqual({
      answer: "Digital products are not eligible for refunds.",
      sources: [{ docId: "refund-policy", title: "Refund Policy" }],
    });
  });

  it("embeds the question as a query and passes topK to the store", async () => {
    const { service, embeddings, store } = setup([refund1]);
    await service.ask("my question", 4);

    expect(embeddings.calls).toEqual([{ texts: ["my question"], kind: "query" }]);
    expect(store.queries).toEqual([{ vector: [0.1, 0.2, 0.3], topK: 4 }]);
  });

  it("returns the no-information answer without calling the LLM when nothing is found", async () => {
    const { service, llm } = setup([]);
    const result = await service.ask("anything", 3);

    expect(result).toEqual({ answer: NO_INFO_ANSWER, sources: [] });
    expect(llm.prompts).toEqual([]);
  });

  it("returns the no-information answer without calling the LLM when every match scores below the threshold", async () => {
    const { service, llm } = setup([unrelated]);
    const result = await service.ask("anything", 3);

    expect(result).toEqual({ answer: NO_INFO_ANSWER, sources: [] });
    expect(llm.prompts).toEqual([]);
  });

  it("keeps low-score matches out of the prompt and the sources", async () => {
    const { service, llm } = setup([refund1, unrelated]);
    const result = await service.ask("Can I get a refund?", 3);

    expect(llm.prompts).toHaveLength(1);
    expect(llm.prompts[0]).toContain("No refunds on digital goods.");
    expect(llm.prompts[0]).not.toContain("Boil pasta");
    expect(result.sources).toEqual([{ docId: "refund-policy", title: "Refund Policy" }]);
  });

  it("puts the question and the retrieved chunks in the prompt", async () => {
    const { service, llm } = setup([refund1, shipping]);
    await service.ask("Can I get a refund?", 3);

    expect(llm.prompts[0]).toContain("Question: Can I get a refund?");
    expect(llm.prompts[0]).toContain("[1] Refund Policy");
    expect(llm.prompts[0]).toContain("[2] Shipping");
  });

  it("lists each document once, in order of relevance", async () => {
    const { service } = setup([refund1, shipping, refund2]);
    const result = await service.ask("anything", 3);

    expect(result.sources).toEqual([
      { docId: "refund-policy", title: "Refund Policy" },
      { docId: "shipping", title: "Shipping" },
    ]);
  });

  it("does not leak chunk text into the sources", async () => {
    const { service } = setup([refund1]);
    const result = await service.ask("anything", 3);

    expect(Object.keys(result.sources[0] ?? {})).toEqual(["docId", "title"]);
  });

  it("respects a custom minimum score", async () => {
    const { service, llm } = setup([shipping], 0.8);
    const result = await service.ask("anything", 3);

    expect(result.answer).toBe(NO_INFO_ANSWER);
    expect(llm.prompts).toEqual([]);
  });

  it("does not call the store or the LLM when embedding fails", async () => {
    const store = new FakeStore([refund1]);
    const llm = new FakeLLM();
    const failing: EmbeddingProvider = {
      embed: async () => {
        throw new Error("embedding quota exceeded");
      },
    };
    const service = new AskService(failing, store, llm);

    await expect(service.ask("anything", 3)).rejects.toThrow("embedding quota exceeded");
    expect(store.queries).toEqual([]);
    expect(llm.prompts).toEqual([]);
  });

  it("propagates vector store errors without calling the LLM", async () => {
    const llm = new FakeLLM();
    const failingStore: VectorStore = {
      upsert: async () => {},
      deleteByDoc: async () => {},
      query: async () => {
        throw new Error("pinecone unavailable");
      },
    };
    const service = new AskService(new FakeEmbeddings(), failingStore, llm);

    await expect(service.ask("anything", 3)).rejects.toThrow("pinecone unavailable");
    expect(llm.prompts).toEqual([]);
  });

  it("propagates LLM errors", async () => {
    const failingLlm: LLMProvider = {
      generate: async () => {
        throw new Error("llm unavailable");
      },
    };
    const service = new AskService(new FakeEmbeddings(), new FakeStore([refund1]), failingLlm);

    await expect(service.ask("anything", 3)).rejects.toThrow("llm unavailable");
  });
});
