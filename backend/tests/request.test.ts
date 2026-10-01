import { describe, it, expect } from "vitest";
import { parseBody } from "../src/http/request";
import { askRequestSchema, ingestRequestSchema } from "../src/http/validation";

describe("parseBody", () => {
  it("returns the validated data for a valid body", () => {
    const result = parseBody(askRequestSchema, JSON.stringify({ question: "  hello  " }));
    expect(result).toEqual({ success: true, data: { question: "hello", topK: 3 } });
  });

  it.each([undefined, "", "   "])("rejects a missing body (%j)", (body) => {
    expect(parseBody(askRequestSchema, body)).toEqual({ success: false, errors: ["Request body is required"] });
  });

  it("rejects a body that is not valid JSON", () => {
    expect(parseBody(askRequestSchema, "{not json")).toEqual({
      success: false,
      errors: ["Request body must be valid JSON"],
    });
  });

  it("reports each schema violation with the path of the field", () => {
    const body = JSON.stringify({ documents: [{ id: "a#b", title: "", content: "ok" }] });
    const result = parseBody(ingestRequestSchema, body);

    expect(result.success).toBe(false);
    const errors = result.success ? [] : result.errors;
    expect(errors.some((e) => e.startsWith("documents.0.id:"))).toBe(true);
    expect(errors.some((e) => e.startsWith("documents.0.title:"))).toBe(true);
  });

  it("uses 'body' as the path when the whole body has the wrong shape", () => {
    const result = parseBody(askRequestSchema, JSON.stringify("just a string"));
    expect(result.success).toBe(false);
    expect(!result.success && result.errors[0]?.startsWith("body:")).toBe(true);
  });
});
