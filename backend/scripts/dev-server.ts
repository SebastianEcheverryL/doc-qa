// Local stand-in for API Gateway: turns real HTTP requests into API Gateway
// events and calls the same Lambda handlers that get deployed.
// Run with: npm run dev   (reads backend/.env, listens on http://localhost:3001)

import { createServer, type IncomingMessage, type Server } from "node:http";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { handler as askHandler } from "../src/handlers/ask";
import { handler as ingestHandler } from "../src/handlers/ingest";

type LambdaHandler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>;

const routes: Record<string, LambdaHandler> = {
  "POST /ingest": ingestHandler,
  "POST /ask": askHandler,
};

// API Gateway answers the CORS preflight itself (see CorsConfiguration in template.yaml);
// the local server has to do it by hand.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function toEvent(req: IncomingMessage, body: string): APIGatewayProxyEventV2 {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers[name] = value;
  }

  return {
    version: "2.0",
    routeKey: `${method} ${url.pathname}`,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers,
    requestContext: {
      accountId: "local",
      apiId: "local",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method,
        path: url.pathname,
        protocol: "HTTP/1.1",
        sourceIp: req.socket.remoteAddress ?? "127.0.0.1",
        userAgent: headers["user-agent"] ?? "",
      },
      requestId: crypto.randomUUID(),
      routeKey: `${method} ${url.pathname}`,
      stage: "$default",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: body === "" ? undefined : body,
    isBase64Encoded: false,
  };
}

export function createDevServer(): Server {
  return createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const path = new URL(req.url ?? "/", "http://localhost").pathname;

    if (method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS).end();
      return;
    }

    const lambda = routes[`${method} ${path}`];
    if (!lambda) {
      res.writeHead(404, { "Content-Type": "application/json", ...CORS_HEADERS });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const result = await lambda(toEvent(req, await readBody(req)));
    res.writeHead(result.statusCode ?? 200, Object.fromEntries(Object.entries(result.headers ?? {}).map(([k, v]) => [k, String(v)])));
    res.end(result.body ?? "");
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3001);
  createDevServer().listen(port, () => {
    console.log(`Dev server listening on http://localhost:${port}  (POST /ingest, POST /ask)`);
  });
}
