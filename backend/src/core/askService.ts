import { buildPrompt } from "./prompt";
import type { Chunk, SourceRef } from "./types";
import type { EmbeddingProvider, LLMProvider, VectorStore } from "../providers/types";

export interface AskResult {
  answer: string;
  sources: SourceRef[];
}

export const NO_INFO_ANSWER = "I don't have enough information to answer that question.";
const DEFAULT_MIN_SCORE = 0.65;

export class AskService {
  constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly store: VectorStore,
    private readonly llm: LLMProvider,
    private readonly minScore: number = DEFAULT_MIN_SCORE
  ) {}

  async ask(question: string, topK: number): Promise<AskResult> {
    const [vector] = await this.embeddings.embed([question], "query");
    if (!vector) {
      throw new Error("Failed to embed question");
    }
    const matches = await this.store.query(vector, topK);
    const relevantMatches = matches.filter((m) => m.score >= this.minScore);

    if (relevantMatches.length === 0) {
      return { answer: NO_INFO_ANSWER, sources: [] };
    }

    const chunks: Chunk[] = relevantMatches.map((m) => ({
      id: m.id,
      docId: m.metadata.docId,
      title: m.metadata.title,
      text: m.metadata.chunkText,
    }));

    const prompt = buildPrompt(question, chunks);
    const answer = await this.llm.generate(prompt);

    const seen = new Set<string>();
    const sources: SourceRef[] = [];
    for (const match of relevantMatches) {
      if (seen.has(match.metadata.docId)) continue;
      seen.add(match.metadata.docId);
      sources.push({ docId: match.metadata.docId, title: match.metadata.title });
    }
    return { answer, sources };
  }
}
