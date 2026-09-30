import { Document, Chunk } from "./types";
export interface ChunkOptions {
  maxChars: number;
  overlap: number;
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function groupParagraphs(paragraphs: string[], maxChars: number): string[]{
    const chunks: string[] = [];
    let current = "";
   

    for (const p of paragraphs) {
        const candidate = current === "" ? p : current + "\n\n" + p;
        if (current !== "" && candidate.length > maxChars) {
            chunks.push(current);
            current = p;
        } else {
            current = candidate;
        } 
    }
    if (current !== "") chunks.push(current); 
    return chunks;
    
}

function splitLongText(text: string, maxChars: number): string[] {
    const pieces: string[] = [];
    for (let start = 0; start < text.length; start += maxChars) {
        pieces.push(text.slice(start, start + maxChars));
    }
    return pieces;
}
function applyOverlap(chunks: string[], overlap: number): string[] {
    if (overlap <= 0) return chunks;
    return chunks.map((chunk, i) => {
        if (i === 0) return chunk;
        const prevChunk = chunks[i - 1];
        return prevChunk === undefined ? chunk : prevChunk.slice(-overlap) + chunk;
    });
}


export function chunkDocument(doc: Document, options: ChunkOptions = { maxChars: 800, overlap: 100 }): Chunk[]{
    const paragraphs = splitParagraphs(doc.content)
        .flatMap((p) => splitLongText(p, options.maxChars));
    const chunksText = groupParagraphs(paragraphs, options.maxChars);
    const chunksWithOverlap = applyOverlap(chunksText, options.overlap);
    return chunksWithOverlap.map((text, i) => ({ id: `${doc.id}#chunk-${i + 1}`, docId: doc.id, title: doc.title, text }));
}
