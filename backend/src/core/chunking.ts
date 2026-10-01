import { Document, Chunk } from "./types";

export interface ChunkOptions {
  /** Target size of a chunk, in characters (the overlap is added on top of it). */
  maxChars: number;
  /** How many characters of the previous chunk are repeated at the start of the next one. */
  overlap: number;
}

const DEFAULT_OPTIONS: ChunkOptions = { maxChars: 800, overlap: 100 };

// A single-line Markdown heading such as "## Equipment".
const HEADING = /^#{1,6}\s+\S/;

function splitParagraphs(content: string): string[] {
  return content
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Glues every Markdown heading to the paragraph that follows it, so a heading is never
 * left at the end of one chunk while its content starts the next one.
 */
function attachHeadings(paragraphs: string[]): string[] {
  const result: string[] = [];
  let pendingHeadings: string[] = [];

  for (const paragraph of paragraphs) {
    if (HEADING.test(paragraph) && !paragraph.includes("\n")) {
      pendingHeadings.push(paragraph);
      continue;
    }
    result.push([...pendingHeadings, paragraph].join("\n\n"));
    pendingHeadings = [];
  }

  // A heading with nothing after it (end of the document) stays on its own.
  if (pendingHeadings.length > 0) result.push(pendingHeadings.join("\n\n"));
  return result;
}

/**
 * Splits text that is longer than maxChars. It cuts at the last whitespace of the window
 * (as long as that keeps at least half of it), so words are not split in the middle.
 * Text without any usable whitespace, such as a very long token, is cut at maxChars.
 */
function splitLongText(text: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    if (end === text.length) {
      pieces.push(text.slice(start));
      break;
    }

    // Looking one character past the window lets a word that ends exactly at maxChars stay whole.
    const window = text.slice(start, end + 1);
    let cut = -1;
    for (let i = window.length - 1; i > maxChars / 2; i--) {
      if (/\s/.test(window.charAt(i))) {
        cut = i;
        break;
      }
    }

    if (cut === -1) {
      pieces.push(text.slice(start, end));
      start = end;
    } else {
      pieces.push(text.slice(start, start + cut));
      start += cut + 1;
    }
  }

  return pieces.map((piece) => piece.trim()).filter((piece) => piece.length > 0);
}

function groupParagraphs(paragraphs: string[], maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current === "" ? paragraph : current + "\n\n" + paragraph;
    if (current !== "" && candidate.length > maxChars) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current !== "") chunks.push(current);
  return chunks;
}

/**
 * The last `overlap` characters of a chunk, without a partial word at the start.
 * If there is no word boundary in that window, there is no overlap at all.
 */
function tail(text: string, overlap: number): string {
  if (overlap >= text.length) return text;

  const start = text.length - overlap;
  const piece = text.slice(start);
  const cutInsideWord = !/\s/.test(text.charAt(start - 1)) && !/^\s/.test(piece);
  if (!cutInsideWord) return piece.trimStart();

  const firstSpace = piece.search(/\s/);
  return firstSpace === -1 ? "" : piece.slice(firstSpace).trimStart();
}

function applyOverlap(chunks: string[], overlap: number): string[] {
  if (overlap <= 0) return chunks;

  return chunks.map((chunk, i) => {
    const previous = chunks[i - 1];
    if (previous === undefined) return chunk;

    const repeated = tail(previous, overlap);
    return repeated === "" ? chunk : `${repeated}\n\n${chunk}`;
  });
}

/**
 * Splits a document into chunks of about `maxChars` characters:
 * paragraphs are kept whole when they fit, headings travel with their content,
 * long paragraphs are cut at word boundaries, and each chunk repeats the end of the previous one.
 */
export function chunkDocument(doc: Document, options: ChunkOptions = DEFAULT_OPTIONS): Chunk[] {
  const paragraphs = attachHeadings(splitParagraphs(doc.content)).flatMap((p) => splitLongText(p, options.maxChars));
  const texts = applyOverlap(groupParagraphs(paragraphs, options.maxChars), options.overlap);

  return texts.map((text, i) => ({
    id: `${doc.id}#chunk-${i + 1}`,
    docId: doc.id,
    title: doc.title,
    text,
  }));
}
