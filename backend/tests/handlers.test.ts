import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createAskHandler } from "../src/handlers/ask";
import { createIngestHandler } from "../src/handlers/ingest";
import type { AskResult } from "../src/core/askService";
import type { IngestResult } from "../src/core/ingestService";
import type { Document } from "../src/core/types";

const event = (body: string | undefined): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "POST /test",
  rawPath: "/test",
  rawQueryString: "",
  headers: { "content-type": "application/json" },
  requestContext: {
    accountId: "123456789012",
    apiId: "api-id",
    domainName: "example.execute-api.local",
    domainPrefix: "example",
    http: { method: "POST", path: "/test", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "vitest" },
    requestId: "request-id",
    routeKey: "POST /test",
    stage: "$default",
    time: "01/Jan/2026:00:00:00 +0000",
    timeEpoch: 0,
  },
  body,
  isBase64Encoded: false,
});

const json = (value: unknown) => event(JSON.stringify(value));
const bodyOf = (response: { body?: string | undefined }): unknown => JSON.parse(response.body ?? "");

// The handlers log the real error; keep the test output clean and check the logging.
let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorLog.mockRestore();
});

describe("ask handler", () => {
  const answer: AskResult = {
    answer: "Digital products are not eligible for refunds.",
    sources: [{ docId: "refund-policy", title: "Refund Policy" }],
  };

  const setup = (impl: () => Promise<AskResult> = async () => answer) => {
    const ask = vi.fn(impl);
    return { ask, handler: createAskHandler(() => ({ ask })) };
  };

  it("returns 200 with the answer and the sources", async () => {
    const { handler } = setup();
    const response = await handler(json({ question: "Can I get a refund on a digital product?", topK: 3 }));

    expect(response.statusCode).toBe(200);
    expect(bodyOf(response)).toEqual(answer);
  });

  it("passes the trimmed question and the default topK to the service", async () => {
    const { handler, ask } = setup();
    await handler(json({ question: "  hello  " }));
    expect(ask).toHaveBeenCalledWith("hello", 3);
  });

  it.each([
    ["a missing body", undefined],
    ["an empty body", ""],
    ["a body that is not JSON", "{oops"],
    ["an empty question", JSON.stringify({ question: "  " })],
    ["a topK out of range", JSON.stringify({ question: "hi", topK: 99 })],
    ["a topK that is not an integer", JSON.stringify({ question: "hi", topK: 1.5 })],
  ])("returns 400 and does not call the service for %s", async (_name, body) => {
    const { handler, ask } = setup();
    const response = await handler(event(body));

    expect(response.statusCode).toBe(400);
    expect(bodyOf(response)).toMatchObject({ error: expect.any(String) });
    expect(ask).not.toHaveBeenCalled();
  });

  it("lists what is wrong in the details of a 400", async () => {
    const { handler } = setup();
    const response = await handler(json({ question: "" }));
    const body = bodyOf(response) as { details: string[] };

    expect(body.details.some((d) => d.startsWith("question:"))).toBe(true);
  });

  it("returns 502 without leaking the upstream error when the service fails", async () => {
    const { handler } = setup(async () => {
      throw new Error("pinecone key pcsk_secret rejected");
    });
    const response = await handler(json({ question: "hi" }));

    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain("pcsk_secret");
    expect(errorLog).toHaveBeenCalled();
  });

  it("returns 500 without leaking details when the service cannot be created (bad config)", async () => {
    const handler = createAskHandler(() => {
      throw new Error("Missing env variable PINECONE_API_KEY");
    });
    const response = await handler(json({ question: "hi" }));

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("PINECONE_API_KEY");
    expect(errorLog).toHaveBeenCalled();
  });

  it("answers with CORS headers", async () => {
    const { handler } = setup();
    const response = await handler(json({ question: "hi" }));
    expect(response.headers?.["Access-Control-Allow-Origin"]).toBe("*");
  });
});

describe("ingest handler", () => {
  const result: IngestResult = { ingestedDocuments: 1, ingestedChunks: 4 };
  const documents = [{ id: "refund-policy", title: "Refund Policy", content: "Full refund within 30 days." }];

  const setup = (impl: (docs: Document[]) => Promise<IngestResult> = async () => result) => {
    const ingest = vi.fn(impl);
    return { ingest, handler: createIngestHandler(() => ({ ingest })) };
  };

  it("returns 200 with the number of documents and chunks", async () => {
    const { handler } = setup();
    const response = await handler(json({ documents }));

    expect(response.statusCode).toBe(200);
    expect(bodyOf(response)).toEqual(result);
  });

  it("passes the validated documents to the service", async () => {
    const { handler, ingest } = setup();
    await handler(json({ documents: [{ id: "a", title: "  A  ", content: "  text  " }] }));
    expect(ingest).toHaveBeenCalledWith([{ id: "a", title: "A", content: "text" }]);
  });

  it.each([
    ["a missing body", undefined],
    ["a body that is not JSON", "not json"],
    ["no documents", JSON.stringify({ documents: [] })],
    ["a doc id with '#'", JSON.stringify({ documents: [{ id: "a#b", title: "t", content: "c" }] })],
    ["empty content", JSON.stringify({ documents: [{ id: "a", title: "t", content: " " }] })],
  ])("returns 400 and does not call the service for %s", async (_name, body) => {
    const { handler, ingest } = setup();
    const response = await handler(event(body));

    expect(response.statusCode).toBe(400);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("returns 502 without leaking the upstream error when the service fails", async () => {
    const { handler } = setup(async () => {
      throw new Error("gemini quota exceeded for key AIza_secret");
    });
    const response = await handler(json({ documents }));

    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain("AIza_secret");
    expect(errorLog).toHaveBeenCalled();
  });

  it("returns 500 when the service cannot be created (bad config)", async () => {
    const handler = createIngestHandler(() => {
      throw new Error("Missing env variable GEMINI_API_KEY");
    });
    const response = await handler(json({ documents }));

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("GEMINI_API_KEY");
  });
});
