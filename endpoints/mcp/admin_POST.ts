/**
 * The admin MCP connector, at /_api/mcp/admin. Transport and OAuth live in helpers/mcpServer and
 * helpers/mcpOauth; this file maps tool calls onto the admin endpoints.
 */

import type { McpAccess } from "../../helpers/mcpOauth";
import { describeMcpScope, isMcpDestructive, McpPolicyError } from "../../helpers/mcpPolicy";
import { handleMcpRequest } from "../../helpers/mcpServer";
import {
  buildToolDefinitions,
  SERVER_INSTRUCTIONS,
  SERVER_NAME,
  SERVER_VERSION,
  TOOL_WRITE_ROUTES,
} from "../../helpers/mcpToolDefs";
import { callRead, callWrite, loadAdmin, McpToolError } from "../../helpers/mcpTools";

async function callTool(
  access: McpAccess,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (access.audience !== "admin") {
    throw new McpToolError("This connector only accepts admin tokens.");
  }
  const { adminId } = access;

  if (name === "testkart_whoami") {
    const admin = await loadAdmin(adminId);
    return { admin, scope: describeMcpScope() };
  }

  if (name === "testkart_read") {
    const path = args.path;
    if (typeof path !== "string") throw new McpToolError("path is required.");
    const query = (args.query ?? undefined) as
      | Record<string, string | number | boolean>
      | undefined;
    return callRead(adminId, path, query);
  }

  const routeKey = TOOL_WRITE_ROUTES[name];
  if (!routeKey) throw new McpToolError(`Unknown tool "${name}".`);

  // Strip the confirmation flag - it gates the call here and is not part of the endpoint contract.
  const { confirm, ...body } = args as { confirm?: unknown } & Record<string, unknown>;

  if (isMcpDestructive(routeKey) && confirm !== true) {
    throw new McpPolicyError(
      `Refused: ${name} permanently deletes a record. Show the user exactly what will be deleted, ` +
        "then call again with confirm: true once they approve."
    );
  }

  if (routeKey === "admin/blog/comments/moderate" && body.action === "delete" && confirm !== true) {
    throw new McpPolicyError(
      'Refused: action "delete" permanently removes the comment. Show it to the user and pass ' +
        'confirm: true once they approve, or use "reject" to hide it instead.'
    );
  }

  return callWrite(adminId, routeKey, body);
}

export async function handle(request: Request) {
  return handleMcpRequest(request, {
    audience: "admin",
    name: SERVER_NAME,
    version: SERVER_VERSION,
    instructions: SERVER_INSTRUCTIONS,
    listTools: buildToolDefinitions,
    callTool,
  });
}