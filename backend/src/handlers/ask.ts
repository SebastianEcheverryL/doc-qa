import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { AskService } from "../core/askService";
import { badGateway, badRequest, internalError, ok } from "../http/responses";
import { parseBody } from "../http/request";
import { askRequestSchema } from "../http/validation";
import { getServices } from "./services";


export function createAskHandler(getService: () => Pick<AskService, "ask">) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
      const parsed = parseBody(askRequestSchema, event.body);
      if (!parsed.success) {
        return badRequest("Invalid request", parsed.errors);
      }
      const service = getService();
      try{
        const result = await service.ask(parsed.data.question, parsed.data.topK);
        return ok(result);
      } catch (error) {
        console.error("ask: upstream failure", error);
        return badGateway();
      }     
    } catch (error) {
      console.error("ask: internal error", error);
      return internalError(); 
    }
  };
}
export const handler = createAskHandler(() => getServices().ask);

