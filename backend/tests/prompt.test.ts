import { describe, it, expect } from "vitest";
import { buildPrompt } from "../src/core/prompt";
import type { Chunk } from "../src/core/types";

const chunk = (n: number, title: string, text: string): Chunk => ({
  id: `doc-${n}#chunk-1`,
  docId: `doc-${n}`,
  title,
  text,
});

const refund = chunk(1, "Refund Policy", "Full refund within 30 days. No refunds on digital goods.");
const shipping = chunk(2, "Shipping", "Orders ship within 2 business days.");

describe("buildPrompt", () => {
  it("includes the question", () => {
    const prompt = buildPrompt("Can I get a refund?", [refund]);
    expect(prompt).toContain("Question: Can I get a refund?");
  });

  it("includes the text and title of every chunk", () => {
    const prompt = buildPrompt("Anything?", [refund, shipping]);
    expect(prompt).toContain("Refund Policy");
    expect(prompt).toContain("No refunds on digital goods.");
    expect(prompt).toContain("Shipping");
    expect(prompt).toContain("Orders ship within 2 business days.");
  });

  it("numbers the chunks in the order they were given", () => {
    const prompt = buildPrompt("Anything?", [refund, shipping]);
    expect(prompt).toContain("[1] Refund Policy");
    expect(prompt).toContain("[2] Shipping");
    expect(prompt.indexOf("[1] Refund Policy")).toBeLessThan(prompt.indexOf("[2] Shipping"));
  });

  it("tells the model to answer only from the context", () => {
    const prompt = buildPrompt("Anything?", [refund]);
    expect(prompt).toContain("ONLY");
    expect(prompt).toContain("There is no information available.");
  });

  it("treats the context as data, not as instructions", () => {
    const prompt = buildPrompt("Anything?", [refund]);
    expect(prompt).toContain("not instructions");
  });

  it("puts the context before the question and ends with the answer cue", () => {
    const prompt = buildPrompt("Anything?", [refund]);
    expect(prompt.indexOf("Context:")).toBeLessThan(prompt.indexOf("Question:"));
    expect(prompt.endsWith("Answer:")).toBe(true);
  });
});
