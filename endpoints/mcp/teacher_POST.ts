/**
 * The teacher MCP connector, at /_api/mcp/teacher. Transport and OAuth live in helpers/mcpServer
 * and helpers/mcpOauth; this file maps tool calls onto the teacher actions.
 */

import type { McpAccess } from "../../helpers/mcpOauth";
import { handleMcpRequest } from "../../helpers/mcpServer";
import {
  callTeacherRead,
  callTeacherWrite,
  describeTeacherAccount,
  describeTeacherAction,
  listTeacherActions,
  McpTeacherToolError,
} from "../../helpers/mcpTeacherActions";
import {
  buildTeacherToolDefinitions,
  TEACHER_SERVER_INSTRUCTIONS,
  TEACHER_SERVER_NAME,
  TEACHER_SERVER_VERSION,
} from "../../helpers/mcpTeacherToolDefs";

function requireAction(args: Record<string, unknown>): string {
  if (typeof args.action !== "string" || !args.action) {
    throw new McpTeacherToolError("action is required.");
  }
  return args.action;
}

function optionalObject(value: unknown, name: string): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new McpTeacherToolError(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

async function callTool(
  access: McpAccess,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (access.audience !== "teacher") {
    throw new McpTeacherToolError("This connector only accepts teacher tokens.");
  }

  switch (name) {
    case "teacher_whoami":
      return describeTeacherAccount(access);
    case "teacher_actions":
      return listTeacherActions(args.kind === "read" || args.kind === "write" ? args.kind : undefined);
    case "teacher_action_schema":
      return describeTeacherAction(requireAction(args));
    case "teacher_read":
      return callTeacherRead(access, requireAction(args), optionalObject(args.query, "query"));
    case "teacher_write":
      return callTeacherWrite(
        access,
        requireAction(args),
        optionalObject(args.body, "body"),
        args.confirm === true
      );
    default:
      throw new McpTeacherToolError(`Unknown tool "${name}".`);
  }
}

export async function handle(request: Request) {
  return handleMcpRequest(request, {
    audience: "teacher",
    name: TEACHER_SERVER_NAME,
    version: TEACHER_SERVER_VERSION,
    instructions: TEACHER_SERVER_INSTRUCTIONS,
    listTools: buildTeacherToolDefinitions,
    callTool,
  });
}