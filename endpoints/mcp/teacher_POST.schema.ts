import { z } from "zod";
import { JsonRpcResponse, jsonRpcRequestSchema } from "../../helpers/mcpSchemas";

/**
 * JSON-RPC 2.0, not the superjson envelope the rest of the API uses. MCP clients such as Claude.ai
 * call this directly with a Bearer token; nothing in the frontend does.
 */
export const schema = jsonRpcRequestSchema;

export type InputType = z.infer<typeof schema>;

export type OutputType = JsonRpcResponse;