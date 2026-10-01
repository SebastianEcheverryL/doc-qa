import { GoogleGenAI } from "@google/genai";
import type { EmbeddingProvider, EmbedKind, LLMProvider } from "./types";

const BATCH_SIZE = 50;

export class GeminiEmbeddings implements EmbeddingProvider {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly dimension: number
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
    const vectors: number[][] = [];

    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      const batch = texts.slice(start, start + BATCH_SIZE);
      const taskType = kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";
      const response = await this.ai.models.embedContent({
        model: this.model,
        contents: batch,
        config: { outputDimensionality: this.dimension, taskType: taskType },
      });
      const embeddings = response.embeddings;
      if (!embeddings || embeddings.length !== batch.length) {
        throw new Error(`Expected ${batch.length} embeddings, got ${embeddings?.length ?? 0}`);
      }
      for (const embedding of embeddings) {
        const values = embedding.values;
        if (!values) throw new Error("Gemini returned an embedding with undefined values");
        vectors.push(values);
      }
    }

    return vectors;
  }
}

export class GeminiLLM implements LLMProvider {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      // Thinking tokens count against maxOutputTokens: with thinking on, a 512-token limit
      // can be spent almost entirely on reasoning and leave a cut-off answer. RAG answers
      // only need to restate the context, so thinking is turned off.
      config: { maxOutputTokens: 1024, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
    });
    const text = response.text;
    if (!text) throw new Error("Gemini did not return any text");
    return text;
  }
}
