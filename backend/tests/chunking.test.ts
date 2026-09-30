import { describe, it, expect } from "vitest";
import { chunkDocument } from "../src/core/chunking";

const doc = (content: string) => ({ id: "d", title: "D", content });
const texts = (content: string, maxChars: number, overlap: number) =>
  chunkDocument(doc(content), { maxChars, overlap }).map((c) => c.text);

describe("chunkDocument", () => {
  it("returns [] for empty content", () => {
    expect(chunkDocument(doc(""))).toEqual([]);
  });

  it("returns [] for whitespace-only content", () => {
    expect(chunkDocument(doc("  \n\n  "))).toEqual([]);
  });

  it("keeps short text in a single chunk", () => {
    expect(chunkDocument(doc("hello"))).toEqual([
      { id: "d#chunk-1", docId: "d", title: "D", text: "hello" },
    ]);
  });

  it("groups paragraphs up to maxChars", () => {
    expect(texts("aaaa\n\nbbbb\n\ncccc", 10, 0)).toEqual(["aaaa\n\nbbbb", "cccc"]);
  });

  it("splits a paragraph longer than maxChars", () => {
    const lengths = texts("x".repeat(25), 10, 0).map((t) => t.length);
    expect(lengths).toEqual([10, 10, 5]);
  });

  it("does not cut a paragraph that fits on its own", () => {
    expect(texts("aaaaaaa\n\nbbbbbbb\n\nccccccc", 10, 0)).toEqual([
      "aaaaaaa",
      "bbbbbbb",
      "ccccccc",
    ]);
  });

  it("starts each chunk (except the first) with the tail of the previous one", () => {
    expect(texts("aaaa\n\nbbbb\n\ncccc", 10, 3)).toEqual(["aaaa\n\nbbbb", "bbbcccc"]);
  });

  it("does not duplicate text between chunks when overlap is 0", () => {
    expect(texts("aaaa\n\nbbbb\n\ncccc", 10, 0)).toEqual(["aaaa\n\nbbbb", "cccc"]);
  });

  it("handles Windows line endings (\\r\\n)", () => {
    expect(texts("aaaa\r\n\r\nbbbb\r\n\r\ncccc", 10, 0)).toEqual(["aaaa\n\nbbbb", "cccc"]);
  });

  it("generates deterministic ids and copies docId and title to every chunk", () => {
    const chunks = chunkDocument(doc("aaaa\n\nbbbb\n\ncccc"), { maxChars: 10, overlap: 0 });
    expect(chunks.map((c) => c.id)).toEqual(["d#chunk-1", "d#chunk-2"]);
    expect(chunks.every((c) => c.docId === "d" && c.title === "D")).toBe(true);
  });
});
