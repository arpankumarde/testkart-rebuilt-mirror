/**
 * MCP transport shared by the admin and teacher connectors: JSON-RPC 2.0 over HTTP POST,
 * authenticated by an OAuth Bearer token issued for the same connector.
 *
 * Responses are plain JSON, not superjson - the callers are external MCP clients.
 */

import { McpAccess, McpAudience, mcpResourceMetadataUrl, resolveAccessToken } from "./mcpOauth";
import { jsonRpcRequestSchema } from "./mcpSchemas";

const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const JSON_HEADERS = { "Content-Type": "application/json" };

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

export type McpServerConfig = {
  audience: McpAudience;
  name: string;
  version: string;
  instructions: string;
  listTools: (access: McpAccess) => ToolDefinition[] | Promise<ToolDefinition[]>;
  callTool: (access: McpAccess, name: string, args: Record<string, unknown>) => Promise<unknown>;
};

function rpcResult(id: string | number | null | undefined, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }), {
    headers: JSON_HEADERS,
  });
}

function rpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
  status = 200
): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }), {
    status,
    headers: JSON_HEADERS,
  });
}

/** A 401 must advertise where to authenticate, or MCP clients cannot discover the OAuth server. */
function unauthorized(config: Pick<McpServerConfig, "audience" | "name">, message: string): Response {
  return new Response(JSON.stringify({ error: "unauthorized", error_description: message }), {
    status: 401,
    headers: {
      ...JSON_HEADERS,
      "WWW-Authenticate": `Bearer realm="${config.name}", resource_metadata="${mcpResourceMetadataUrl(config.audience)}"`,
    },
  });
}

function toolText(payload: unknown, isError = false) {
  return {
    content: [
      {
        type: "text",
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

/** Parse an internal endpoint's response body, unwrapping the superjson { json } envelope. */
export function unwrapEndpointPayload(text: string): unknown {
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 2000) };
  }
  return parsed && typeof parsed === "object" && "json" in parsed
    ? (parsed as { json: unknown }).json
    : parsed;
}

/** Pull a readable message out of an endpoint's error payload: a string or an array of { message }. */
export function extractEndpointError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const { error, details } = payload as { error?: unknown; details?: unknown };
  if (!error) return null;
  if (typeof error === "string") return details ? `${error}: ${String(details)}` : error;
  if (Array.isArray(error)) {
    return error
      .map((entry) =>
        entry && typeof entry === "object" && "message" in entry
          ? String((entry as { message: unknown }).message)
          : JSON.stringify(entry)
      )
      .join("; ");
  }
  return JSON.stringify(error);
}

export async function handleMcpRequest(request: Request, config: McpServerConfig): Promise<Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return unauthorized(config, "A Bearer access token is required.");
  }

  const access = await resolveAccessToken(authHeader.slice(7).trim(), config.audience);
  if (!access) {
    return unauthorized(config, "The access token is invalid, expired or revoked.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await request.text());
  } catch {
    return rpcError(null, -32700, "Parse error: body is not valid JSON.", 400);
  }

  if (Array.isArray(parsed)) {
    // Batching was removed in MCP 2025-06-18 and this server does not accept it.
    return rpcError(null, -32600, "Batched JSON-RPC requests are not supported.", 400);
  }

  const validation = jsonRpcRequestSchema.safeParse(parsed);
  if (!validation.success) {
    return rpcError(null, -32600, `Invalid JSON-RPC request: ${validation.error.message}`, 400);
  }

  const { id, method, params } = validation.data;
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize": {
        const requested = (params as { protocolVersion?: string } | undefined)?.protocolVersion;
        const protocolVersion =
          requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
            ? requested
            : DEFAULT_PROTOCOL_VERSION;
        return rpcResult(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: config.name, version: config.version },
          instructions: config.instructions,
        });
      }

      case "notifications/initialized":
      case "notifications/cancelled":
        // Notifications carry no id and expect no result. A body is still returned because an
        // empty one makes CloudFront hang.
        return new Response(JSON.stringify({ ok: true }), { status: 202, headers: JSON_HEADERS });

      case "ping":
        return rpcResult(id, {});

      case "tools/list":
        return rpcResult(id, { tools: await config.listTools(access) });

      case "tools/call": {
        const callParams = (params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        if (!callParams.name) return rpcError(id, -32602, "tools/call requires a tool name.");
        try {
          const payload = await config.callTool(access, callParams.name, callParams.arguments ?? {});
          return rpcResult(id, toolText(payload));
        } catch (error) {
          // Tool failures are reported inside the result so the model can read and react to them,
          // rather than as protocol errors.
          const message = error instanceof Error ? error.message : "Unknown error";
          return rpcResult(id, toolText(message, true));
        }
      }

      default:
        if (isNotification) {
          return new Response(JSON.stringify({ ok: true }), { status: 202, headers: JSON_HEADERS });
        }
        return rpcError(id, -32601, `Unknown method "${method}".`);
    }
  } catch (error) {
    console.error(`MCP ${config.audience} endpoint error:`, error);
    return rpcError(id, -32603, "Internal server error.", 500);
  }
}

/**
 * GET on a connector URL. This server opens no server-to-client SSE stream, so a signed-in GET gets
 * the 405 the Streamable HTTP transport asks for, and a signed-out one gets the same 401 as a POST.
 */
export async function handleMcpGet(
  request: Request,
  config: Pick<McpServerConfig, "audience" | "name">
): Promise<Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return unauthorized(config, "A Bearer access token is required.");
  }
  if (!(await resolveAccessToken(authHeader.slice(7).trim(), config.audience))) {
    return unauthorized(config, "The access token is invalid, expired or revoked.");
  }
  return new Response(
    JSON.stringify({ error: "method_not_allowed", error_description: "No SSE stream here. Send JSON-RPC with POST." }),
    { status: 405, headers: { ...JSON_HEADERS, Allow: "POST" } }
  );
}
