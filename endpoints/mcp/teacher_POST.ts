/**
 * The teacher MCP connector, at /_api/mcp/teacher. Transport and OAuth live in helpers/mcpServer
 * and helpers/mcpOauth; this file maps tool calls onto the teacher actions, one tool per action.
 */

import type { McpAccess } from "../../helpers/mcpOauth";
import { handleMcpRequest } from "../../helpers/mcpServer";
import {
  callTeacherAction,
  describeTeacherAccount,
  McpTeacherToolError,
} from "../../helpers/mcpTeacherActions";
import {
  buildTeacherToolDefinitions,
  teacherActionForTool,
  TEACHER_SERVER_INSTRUCTIONS,
  TEACHER_SERVER_NAME,
  TEACHER_SERVER_VERSION,
} from "../../helpers/mcpTeacherToolDefs";
import { TEACHER_DOCS, type TeacherDocsTopic } from "../../helpers/mcpQuestionFormatDocs";

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
    case "teacher_docs":
      if (typeof args.topic !== "string" || !Object.prototype.hasOwnProperty.call(TEACHER_DOCS, args.topic)) {
        throw new McpTeacherToolError(`topic must be one of: ${Object.keys(TEACHER_DOCS).join(", ")}.`);
      }
      return TEACHER_DOCS[args.topic as TeacherDocsTopic];
    default: {
      const action = teacherActionForTool(name);
      if (!action) throw new McpTeacherToolError(`Unknown tool "${name}".`);
      return callTeacherAction(access, action, args);
    }
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
