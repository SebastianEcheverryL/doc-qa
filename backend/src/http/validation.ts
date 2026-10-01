import { z } from "zod";

// Doc ids end up inside Pinecone ids ("<docId>#chunk-N"), so they must not contain "#".
const DOC_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

// The limits keep one /ingest call inside the Lambda timeout and the free tier of the embedding API.
// Measured with the Gemini free tier: 60,000 characters (about 84 chunks) are ingested in around 7 seconds,
// while 100,000 characters (about 140 chunks) exceed the embedding quota (HTTP 429).
export const MAX_DOCUMENTS = 10;
export const MAX_CONTENT_CHARS = 50_000;
export const MAX_TOTAL_CHARS = 60_000;

const documentSchema = z.object({
  id: z.string().min(1).max(50).regex(DOC_ID_PATTERN, "id may only contain letters, numbers, '-' and '_'"),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(MAX_CONTENT_CHARS),
});

export const ingestRequestSchema = z.object({
  documents: z
    .array(documentSchema)
    .min(1)
    .max(MAX_DOCUMENTS)
    .refine((docs) => new Set(docs.map((doc) => doc.id)).size === docs.length, "document ids must be unique")
    .refine(
      (docs) => docs.reduce((total, doc) => total + doc.content.length, 0) <= MAX_TOTAL_CHARS,
      `the total content of a request may not exceed ${MAX_TOTAL_CHARS} characters`
    ),
});

export const askRequestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  topK: z.number().int().min(1).max(10).default(3),
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;
export type AskRequest = z.infer<typeof askRequestSchema>;
