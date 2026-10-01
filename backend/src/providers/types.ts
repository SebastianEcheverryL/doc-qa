export interface LLMProvider {
  generate(prompt: string): Promise<string>;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: { docId: string; title: string; chunkText: string };
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata: { docId: string; title: string; chunkText: string };
}

export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  query(vector: number[], topK: number): Promise<VectorMatch[]>;
  deleteByDoc(docId: string): Promise<void>;
}

export type EmbedKind = "document" | "query";

export interface EmbeddingProvider {
  embed(texts: string[], kind: EmbedKind): Promise<number[][]>;
}

