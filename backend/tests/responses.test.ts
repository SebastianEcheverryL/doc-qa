import { describe, it, expect } from "vitest";
import { badGateway, badRequest, internalError, ok } from "../src/http/responses";

const parse = (body: string | undefined): unknown => JSON.parse(body ?? "");

describe("ok", () => {
  it("returns 200 with the body serialized as JSON", () => {
    const response = ok({ ingestedDocuments: 1, ingestedChunks: 4 });
    expect(response.statusCode).toBe(200);
    expect(typeof response.body).toBe("string");
    expect(parse(response.body)).toEqual({ ingestedDocuments: 1, ingestedChunks: 4 });
  });
});

describe("badRequest", () => {
  it("returns 400 with the error message", () => {
    const response = badRequest("Invalid request");
    expect(response.statusCode).toBe(400);
    expect(parse(response.body)).toEqual({ error: "Invalid request" });
  });

  it("includes the details when they are given", () => {
    const response = badRequest("Invalid request", ["question: Too small"]);
    expect(parse(response.body)).toEqual({ error: "Invalid request", details: ["question: Too small"] });
  });
});

describe("badGateway", () => {
  it("returns 502 with a generic message", () => {
    const response = badGateway();
    expect(response.statusCode).toBe(502);
    expect(parse(response.body)).toEqual({ error: expect.any(String) });
  });
});

describe("internalError", () => {
  it("returns 500 with a generic message", () => {
    const response = internalError();
    expect(response.statusCode).toBe(500);
    expect(parse(response.body)).toEqual({ error: expect.any(String) });
  });
});

describe("headers", () => {
  const responses = {
    ok: ok({}),
    badRequest: badRequest("bad"),
    badGateway: badGateway(),
    internalError: internalError(),
  };

  it.each(Object.entries(responses))("%s declares a JSON content type", (_name, response) => {
    expect(response.headers?.["Content-Type"]).toBe("application/json");
  });

  it.each(Object.entries(responses))("%s allows cross-origin calls (CORS) inside the headers", (_name, response) => {
    expect(response.headers?.["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.headers?.["Access-Control-Allow-Headers"]).toBe("Content-Type");
    expect(response.headers?.["Access-Control-Allow-Methods"]).toBe("POST,OPTIONS");
  });

  it.each(Object.entries(responses))("%s only has the fields API Gateway reads", (_name, response) => {
    expect(Object.keys(response).sort()).toEqual(["body", "headers", "statusCode"]);
  });
});
