import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config";

const required = { GEMINI_API_KEY: "g-key", PINECONE_API_KEY: "p-key", PINECONE_INDEX: "my-index" };

describe("loadConfig", () => {
  it("reads the required variables and applies the defaults", () => {
    expect(loadConfig(required)).toEqual({
      geminiApiKey: "g-key",
      pineconeApiKey: "p-key",
      pineconeIndex: "my-index",
      embeddingModel: "gemini-embedding-001",
      embeddingDimension: 768,
      llmModel: "gemini-3.8-flash",
      minScore: 0.65,
    });
  });

  it("uses the optional variables when they are set", () => {
    const config = loadConfig({
      ...required,
      EMBEDDING_MODEL: "other-embeddings",
      EMBEDDING_DIMENSION: "1024",
      LLM_MODEL: "other-llm",
      MIN_SCORE: "0.7",
    });
    expect(config).toMatchObject({
      embeddingModel: "other-embeddings",
      embeddingDimension: 1024,
      llmModel: "other-llm",
      minScore: 0.7,
    });
  });

  it("treats an empty optional variable as not set", () => {
    expect(loadConfig({ ...required, LLM_MODEL: "", MIN_SCORE: "" })).toMatchObject({
      llmModel: "gemini-3.8-flash",
      minScore: 0.65,
    });
  });

  it.each(["GEMINI_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX"])("throws when %s is missing", (name) => {
    const env: Record<string, string> = { ...required };
    delete env[name];
    expect(() => loadConfig(env)).toThrow(name);
  });

  it("throws a clear error for numbers that are not valid", () => {
    expect(() => loadConfig({ ...required, EMBEDDING_DIMENSION: "abc" })).toThrow("EMBEDDING_DIMENSION");
    expect(() => loadConfig({ ...required, EMBEDDING_DIMENSION: "0" })).toThrow("EMBEDDING_DIMENSION");
    expect(() => loadConfig({ ...required, EMBEDDING_DIMENSION: "7.5" })).toThrow("EMBEDDING_DIMENSION");
    expect(() => loadConfig({ ...required, MIN_SCORE: "1.5" })).toThrow("MIN_SCORE");
    expect(() => loadConfig({ ...required, MIN_SCORE: "high" })).toThrow("MIN_SCORE");
  });
});
