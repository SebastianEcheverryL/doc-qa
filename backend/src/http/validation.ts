import { z } from "zod";

// Doc ids end up inside Pinecone ids ("<docId>#chunk-N"), so they must not contain "#".
const DOC_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const documentSchema = z.object({
  id: z.string().regex(DOC_ID_PATTERN, "Invalid doc id").trim().min(1).max(50),
  title: z.string().trim().min(1).max(200), 
  content: z.string().trim().min(1).max(50_000), 
});

export const ingestRequestSchema = z.object({
  documents: z.array(documentSchema).min(1).max(20), 
});

export const askRequestSchema = z.object({
  question: z.string().trim().min(1).max(1000), 
  topK: z.number().int().min(1).max(10).default(3), 
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;
export type AskRequest = z.infer<typeof askRequestSchema>;


