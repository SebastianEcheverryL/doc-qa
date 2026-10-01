import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { IngestService } from "../core/ingestService";
import { badGateway, badRequest, internalError, ok } from "../http/responses";
import { parseBody } from "../http/request";
import { ingestRequestSchema } from "../http/validation";
import { getServices } from "./services";

export function createIngestHandler(getService: () => Pick<IngestService, "ingest">) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
      const parsed = parseBody(ingestRequestSchema, event.body);
      if (!parsed.success) {
        return badRequest("Invalid request", parsed.errors);
      }
      const service = getService();
      try {
        const result = await service.ingest(parsed.data.documents);
        return ok(result);
      } catch (error) {
        console.error("ingest: upstream failure", error);
        return badGateway();
      }
    } catch (error) {
      console.error("ingest: internal error", error);
      return internalError();
    }
  };
}

export const handler = createIngestHandler(() => getServices().ingest);
