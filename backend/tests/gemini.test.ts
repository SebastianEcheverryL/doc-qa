import { beforeEach, describe, expect, it, vi } from "vitest";

// The Gemini SDK is replaced by a fake so these tests never touch the network.
const { embedContent, generateContent } = vi.hoisted(() => ({ embedContent: vi.fn(), generateContent: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { embedContent, generateContent };
  },
}));

import { GeminiEmbeddings, GeminiLLM } from "../src/providers/gemini";

/** An embedContent fake that answers one vector per input text. */
const oneVectorPerText = async ({ contents }: { contents: string[] }) => ({
  embeddings: contents.map((text) => ({ values: [text.length] })),
});

beforeEach(() => {
  embedContent.mockReset();
  generateContent.mockReset();
});

describe("GeminiEmbeddings", () => {
  const embeddings = new GeminiEmbeddings("key", "embedding-model", 768);

  it("does not call the API when there is nothing to embed", async () => {
    expect(await embeddings.embed([], "document")).toEqual([]);
    expect(embedContent).not.toHaveBeenCalled();
  });

  it("returns one vector per text, in the same order", async () => {
    embedContent.mockImplementation(oneVectorPerText);
    expect(await embeddings.embed(["a", "bb", "ccc"], "document")).toEqual([[1], [2], [3]]);
  });

  it("sends the texts in batches of 50 and keeps the order across batches", async () => {
    embedContent.mockImplementation(oneVectorPerText);
    const texts = Array.from({ length: 120 }, (_, i) => "x".repeat(i + 1));

    const vectors = await embeddings.embed(texts, "document");

    expect(embedContent.mock.calls.map(([params]) => params.contents.length)).toEqual([50, 50, 20]);
    expect(vectors.map(([length]) => length)).toEqual(texts.map((t) => t.length));
  });

  it("asks for the configured model and dimension", async () => {
    embedContent.mockImplementation(oneVectorPerText);
    await embeddings.embed(["a"], "document");

    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "embedding-model",
        config: expect.objectContaining({ outputDimensionality: 768 }),
      })
    );
  });

  it.each([
    ["document", "RETRIEVAL_DOCUMENT"],
    ["query", "RETRIEVAL_QUERY"],
  ] as const)("uses the %s task type for %s embeddings", async (kind, taskType) => {
    embedContent.mockImplementation(oneVectorPerText);
    await embeddings.embed(["a"], kind);

    expect(embedContent.mock.calls[0]?.[0].config.taskType).toBe(taskType);
  });

  it("throws when the API returns fewer vectors than texts", async () => {
    embedContent.mockResolvedValue({ embeddings: [{ values: [1] }] });
    await expect(embeddings.embed(["a", "b"], "document")).rejects.toThrow("Expected 2 embeddings, got 1");
  });

  it("throws when the API returns no embeddings at all", async () => {
    embedContent.mockResolvedValue({});
    await expect(embeddings.embed(["a"], "document")).rejects.toThrow("Expected 1 embeddings, got 0");
  });

  it("throws when an embedding has no values", async () => {
    embedContent.mockResolvedValue({ embeddings: [{}] });
    await expect(embeddings.embed(["a"], "document")).rejects.toThrow("undefined values");
  });

  it("lets API errors through so the handler can turn them into a 502", async () => {
    embedContent.mockRejectedValue(new Error("503 high demand"));
    await expect(embeddings.embed(["a"], "document")).rejects.toThrow("503 high demand");
  });
});

describe("GeminiLLM", () => {
  const llm = new GeminiLLM("key", "llm-model");

  it("returns the text of the answer", async () => {
    generateContent.mockResolvedValue({ text: "Digital goods are not refundable." });
    expect(await llm.generate("the prompt")).toBe("Digital goods are not refundable.");
  });

  it("sends the prompt to the configured model", async () => {
    generateContent.mockResolvedValue({ text: "ok" });
    await llm.generate("the prompt");

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: "llm-model", contents: "the prompt" })
    );
  });

  it("disables thinking, which would use up the output token budget and truncate the answer", async () => {
    generateContent.mockResolvedValue({ text: "ok" });
    await llm.generate("the prompt");

    const { config } = generateContent.mock.calls[0]?.[0];
    expect(config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(config.maxOutputTokens).toBeGreaterThan(0);
  });

  it("throws when the model returns no text", async () => {
    generateContent.mockResolvedValue({ text: undefined });
    await expect(llm.generate("the prompt")).rejects.toThrow("did not return any text");
  });
});
