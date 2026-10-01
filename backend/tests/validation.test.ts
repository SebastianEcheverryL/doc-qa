import { describe, it, expect } from "vitest";
import { askRequestSchema, ingestRequestSchema } from "../src/http/validation";

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: "refund-policy",
  title: "Refund Policy",
  content: "Full refund within 30 days with receipt.",
  ...overrides,
});

describe("ingestRequestSchema", () => {
  it("accepts a valid request", () => {
    const result = ingestRequestSchema.safeParse({ documents: [doc()] });
    expect(result.success).toBe(true);
  });

  it("trims title and content", () => {
    const result = ingestRequestSchema.safeParse({ documents: [doc({ title: "  Refund  ", content: "  text  " })] });
    expect(result.success && result.data.documents[0]).toMatchObject({ title: "Refund", content: "text" });
  });

  it("rejects an empty documents list", () => {
    expect(ingestRequestSchema.safeParse({ documents: [] }).success).toBe(false);
  });

  it("rejects a missing documents field", () => {
    expect(ingestRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejects more than 20 documents", () => {
    const documents = Array.from({ length: 21 }, (_, i) => doc({ id: `doc-${i}` }));
    expect(ingestRequestSchema.safeParse({ documents }).success).toBe(false);
  });

  it.each(["a#b", "with space", "slash/id", "ünïcode", ""])("rejects the doc id %j", (id) => {
    expect(ingestRequestSchema.safeParse({ documents: [doc({ id })] }).success).toBe(false);
  });

  it.each(["refund-policy", "doc_1", "A1", "x".repeat(50)])("accepts the doc id %j", (id) => {
    expect(ingestRequestSchema.safeParse({ documents: [doc({ id })] }).success).toBe(true);
  });

  it("rejects an empty or whitespace-only title", () => {
    expect(ingestRequestSchema.safeParse({ documents: [doc({ title: "   " })] }).success).toBe(false);
  });

  it("rejects empty or whitespace-only content", () => {
    expect(ingestRequestSchema.safeParse({ documents: [doc({ content: "  \n  " })] }).success).toBe(false);
  });

  it("rejects content over the size limit", () => {
    expect(ingestRequestSchema.safeParse({ documents: [doc({ content: "x".repeat(50_001) })] }).success).toBe(false);
  });

  it("rejects fields of the wrong type", () => {
    expect(ingestRequestSchema.safeParse({ documents: [doc({ id: 123 })] }).success).toBe(false);
    expect(ingestRequestSchema.safeParse({ documents: "nope" }).success).toBe(false);
  });

  it("reports which field is wrong", () => {
    const result = ingestRequestSchema.safeParse({ documents: [doc({ id: "a#b" })] });
    expect(!result.success && result.error.issues[0]?.path).toEqual(["documents", 0, "id"]);
  });
});

describe("askRequestSchema", () => {
  it("accepts a valid request", () => {
    const result = askRequestSchema.safeParse({ question: "Can I get a refund?", topK: 5 });
    expect(result.success && result.data).toEqual({ question: "Can I get a refund?", topK: 5 });
  });

  it("defaults topK to 3 when it is missing", () => {
    const result = askRequestSchema.safeParse({ question: "Can I get a refund?" });
    expect(result.success && result.data.topK).toBe(3);
  });

  it("trims the question", () => {
    const result = askRequestSchema.safeParse({ question: "  hello  " });
    expect(result.success && result.data.question).toBe("hello");
  });

  it("rejects an empty or whitespace-only question", () => {
    expect(askRequestSchema.safeParse({ question: "" }).success).toBe(false);
    expect(askRequestSchema.safeParse({ question: "   " }).success).toBe(false);
  });

  it("rejects a missing question", () => {
    expect(askRequestSchema.safeParse({ topK: 3 }).success).toBe(false);
  });

  it("rejects a question over 1000 characters", () => {
    expect(askRequestSchema.safeParse({ question: "x".repeat(1001) }).success).toBe(false);
  });

  it.each([0, 11, -1, 2.5])("rejects topK %j", (topK) => {
    expect(askRequestSchema.safeParse({ question: "hi", topK }).success).toBe(false);
  });

  it.each([1, 3, 10])("accepts topK %j", (topK) => {
    expect(askRequestSchema.safeParse({ question: "hi", topK }).success).toBe(true);
  });

  it("rejects a topK that is not a number", () => {
    expect(askRequestSchema.safeParse({ question: "hi", topK: "3" }).success).toBe(false);
  });
});
