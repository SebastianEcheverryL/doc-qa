import { Pinecone, Index } from "@pinecone-database/pinecone";
import type { VectorMatch, VectorRecord, VectorStore } from "./types";

const UPSERT_BATCH_SIZE = 100;
const DELETE_BATCH_SIZE = 1000;

export class PineconeStore implements VectorStore {
    private readonly index: Index;


  constructor(apiKey: string, indexName: string) {
    const pinecone = new Pinecone({ apiKey });
    this.index = pinecone.index({ name: indexName });
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    for (let start = 0; start < records.length; start += UPSERT_BATCH_SIZE) {
      const batch = records.slice(start, start + UPSERT_BATCH_SIZE);
      await this.index.upsert({ records: batch });
    }
  }

  async query(vector: number[], topK: number): Promise<VectorMatch[]> {
    const results = await this.index.query({
      vector,
      topK,
      includeMetadata: true
    })
   const matches: VectorMatch[] = [];
   for (const match of results.matches) {
    if (match.score === undefined || match.metadata === undefined) {
        continue;
    }
    const docId = match.metadata.docId;
    const title = match.metadata.title;
    const chunkText = match.metadata.chunkText;
    if ( typeof docId !== "string" || typeof title !== "string" || typeof chunkText !== "string") {
        continue;
    }
    matches.push({
        id: match.id,
        score: match.score,
        metadata: { docId, title, chunkText },
    });   
   }
   return matches;
  }

  async deleteByDoc(docId: string): Promise<void> {
    const prefix = `${docId}#chunk-`;
    const ids: string[] = [];
    let token: string | undefined;
    do {
      const response = await this.index.listPaginated({ prefix, paginationToken: token });
      token = response.pagination?.next;
        for (const item of response.vectors ?? []) {
             if (item.id !== undefined) ids.push(item.id);
        }
    } while (token !== undefined);
    for (let start = 0; start < ids.length; start += DELETE_BATCH_SIZE) {
      const batch = ids.slice(start, start + DELETE_BATCH_SIZE);
      await this.index.deleteMany({ ids: batch });
    }
  }
}
