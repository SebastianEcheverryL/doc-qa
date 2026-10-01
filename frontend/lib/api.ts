const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface DocumentInput {
  id: string;
  title: string;
  content: string;
}

export interface IngestResponse {
  ingestedDocuments: number;
  ingestedChunks: number;
}

export interface Source {
  docId: string;
  title: string;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
}

/** A failed call to the backend. `status` is 0 when the backend could not be reached. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = []
  ) {
    super(message);
  }
}

interface ErrorBody {
  error?: string;
  details?: string[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server. Please try again.", 0);
  }

  if (!response.ok) {
    let errorBody: ErrorBody = {};
    try {
      errorBody = await response.json();
    } catch {
      // The body was not JSON (for example an error page from a proxy): keep the defaults.
    }
    throw new ApiError(errorBody.error ?? `Request failed (${response.status})`, response.status, errorBody.details);
  }

  return response.json();
}

export function ingestDocuments(documents: DocumentInput[]): Promise<IngestResponse> {
  return post<IngestResponse>("/ingest", { documents });
}

export function askQuestion(question: string, topK?: number): Promise<AskResponse> {
  return post<AskResponse>("/ask", { question, topK });
}

/** Turns any error into something safe and friendly to show in the UI. */
export function describeError(error: unknown): { message: string; details: string[] } {
  if (error instanceof ApiError) {
    if (error.status === 502) {
      return { message: "The AI service is temporarily unavailable. Please try again in a moment.", details: [] };
    }
    if (error.status >= 500) {
      return { message: "Something went wrong on the server. Please try again.", details: [] };
    }
    return { message: error.message, details: error.details };
  }
  return { message: "Something went wrong. Please try again.", details: [] };
}
