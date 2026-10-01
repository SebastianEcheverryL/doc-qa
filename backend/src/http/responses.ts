import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: {"Content-Type": "application/json", ...CORS_HEADERS}, body: JSON.stringify(body) };
}

export function ok(body: unknown): APIGatewayProxyStructuredResultV2 {
  return json(200, body); 
}

export function badRequest(message: string, details?: string[]): APIGatewayProxyStructuredResultV2 {
  return json(400, { error: message, details }); 
}

export function badGateway(): APIGatewayProxyStructuredResultV2 {
  return json(502, { error: "bad gateway" });
}

export function internalError(): APIGatewayProxyStructuredResultV2 {
  return json(500, { error: "internal error" });
}
