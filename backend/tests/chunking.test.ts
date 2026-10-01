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
    expect(chunkDocument(doc("hello"))).toEqual([{ id: "d#chunk-1", docId: "d", title: "D", text: "hello" }]);
  });

  it("groups paragraphs up to maxChars", () => {
    expect(texts("aaaa\n\nbbbb\n\ncccc", 10, 0)).toEqual(["aaaa\n\nbbbb", "cccc"]);
  });

  it("does not cut a paragraph that fits on its own", () => {
    expect(texts("aaaaaaa\n\nbbbbbbb\n\nccccccc", 10, 0)).toEqual(["aaaaaaa", "bbbbbbb", "ccccccc"]);
  });

  it("handles Windows line endings (\\r\\n)", () => {
    expect(texts("aaaa\r\n\r\nbbbb\r\n\r\ncccc", 10, 0)).toEqual(["aaaa\n\nbbbb", "cccc"]);
  });

  it("generates deterministic ids and copies docId and title to every chunk", () => {
    const chunks = chunkDocument(doc("aaaa\n\nbbbb\n\ncccc"), { maxChars: 10, overlap: 0 });
    expect(chunks.map((c) => c.id)).toEqual(["d#chunk-1", "d#chunk-2"]);
    expect(chunks.every((c) => c.docId === "d" && c.title === "D")).toBe(true);
  });

  describe("long paragraphs", () => {
    it("cuts a long token without whitespace at maxChars", () => {
      const lengths = texts("x".repeat(25), 10, 0).map((t) => t.length);
      expect(lengths).toEqual([10, 10, 5]);
    });

    it("cuts at word boundaries instead of in the middle of a word", () => {
      expect(texts("one two three four five six", 10, 0)).toEqual(["one two", "three four", "five six"]);
    });

    it("keeps a word that ends exactly at maxChars", () => {
      expect(texts("abcde fghi jklmn", 10, 0)).toEqual(["abcde fghi", "jklmn"]);
    });

    it("never produces a piece longer than maxChars", () => {
      const text = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ".repeat(20);
      expect(texts(text, 50, 0).every((t) => t.length <= 50)).toBe(true);
    });

    it("does not lose any word when it splits", () => {
      const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa";
      expect(texts(text, 20, 0).join(" ")).toBe(text);
    });
  });

  describe("overlap", () => {
    const content = "alpha beta gamma\n\ndelta epsilon zeta";

    it("starts each chunk (except the first) with the end of the previous one", () => {
      expect(texts(content, 20, 10)).toEqual(["alpha beta gamma", "beta gamma\n\ndelta epsilon zeta"]);
    });

    it("drops a partial word at the start of the overlap", () => {
      // The last 8 characters of the first chunk are "ta gamma": "ta" is the end of "beta".
      expect(texts(content, 20, 8)).toEqual(["alpha beta gamma", "gamma\n\ndelta epsilon zeta"]);
    });

    it("uses no overlap when the end of the chunk has no word boundary", () => {
      expect(texts("aaaaaaaaaa\n\nbbbbbbbbbb", 12, 4)).toEqual(["aaaaaaaaaa", "bbbbbbbbbb"]);
    });

    it("repeats the whole previous chunk when the overlap is longer than it", () => {
      expect(texts("one two\n\nthree four", 12, 50)).toEqual(["one two", "one two\n\nthree four"]);
    });

    it("does not duplicate text between chunks when overlap is 0", () => {
      expect(texts(content, 20, 0)).toEqual(["alpha beta gamma", "delta epsilon zeta"]);
    });
  });

  describe("headings", () => {
    it("keeps a heading together with the paragraph that follows it", () => {
      expect(texts("intro text here\n\n## Title\n\nbody text", 25, 0)).toEqual([
        "intro text here",
        "## Title\n\nbody text",
      ]);
    });

    it("keeps consecutive headings together with the next paragraph", () => {
      expect(texts("# A\n\n## B\n\nbody", 100, 0)).toEqual(["# A\n\n## B\n\nbody"]);
    });

    it("keeps a heading at the end of the document", () => {
      expect(texts("some text\n\n## Last", 100, 0)).toEqual(["some text\n\n## Last"]);
    });

    it("does not treat a '#' without a space as a heading", () => {
      expect(texts("#hashtag\n\nbody", 8, 0)).toEqual(["#hashtag", "body"]);
    });
  });

  it("never leaves a heading as the last line of a chunk (realistic Markdown document)", () => {
    const section = (n: number) =>
      `## Section ${n}\n\n${"Employees are expected to follow the policy and ask their manager. ".repeat(4).trim()}`;
    const content = Array.from({ length: 8 }, (_, i) => section(i + 1)).join("\n\n");

    const chunks = texts(content, 800, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const text of chunks) {
      expect(text.trimEnd().split("\n").at(-1)).not.toMatch(/^#{1,6}\s/);
    }
  });
});
