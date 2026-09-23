/**
 * Lets the admin MCP connector change a teacher's catalogue item the way the admin panel's editor
 * does. Each call opens a five-minute admin editing session for the item's teacher
 * (helpers/adminContentEditSession) and runs one teacher endpoint through the teacher connector's
 * action registry, so the editor's route list (helpers/adminContentEdit), the admin's section
 * check and each endpoint's own validation all apply. The session row is removed afterwards.
 */

import {
  ADMIN_EDIT_LABELS,
  ADMIN_EDIT_MODULES,
  ADMIN_EDIT_TYPES,
  AdminEditType,
  isAdminEditRouteAllowed,
  isAdminEditType,
} from "./adminContentEdit";
import { closeAdminEditSession, openAdminEditSession } from "./adminContentEditSession";
import { hasAdminModule } from "./adminPermissions";
import { createAdminSessionToken } from "./getAdminSession";
import { describeTeacherAction, invokeTeacherAction, listTeacherActions } from "./mcpTeacherActions";
import { loadAdmin, McpToolError } from "./mcpTools";

const SESSION_MINUTES = 5;

/** Content types this admin's sections let them edit. */
export function editableContentTypes(permissions: readonly string[]): AdminEditType[] {
  return ADMIN_EDIT_TYPES.filter((type) => hasAdminModule(permissions, [ADMIN_EDIT_MODULES[type]]));
}

function actionsFor(type: AdminEditType) {
  return listTeacherActions().actions.filter((entry) =>
    isAdminEditRouteAllowed(type, `teacher/${entry.action}`)
  );
}

function requireType(value: unknown): AdminEditType {
  if (!isAdminEditType(value)) {
    throw new McpToolError(`type must be one of: ${ADMIN_EDIT_TYPES.join(", ")}.`);
  }
  return value;
}

async function requireEditor(adminId: number, type: AdminEditType) {
  const admin = await loadAdmin(adminId);
  if (!hasAdminModule(admin.permissions ?? [], [ADMIN_EDIT_MODULES[type]])) {
    throw new McpToolError(
      `Refused: your admin account cannot edit a ${ADMIN_EDIT_LABELS[type]}. An admin with ` +
        '"Admins and access" can tick that section for you in the admin panel under Settings.'
    );
  }
  return admin;
}

function requireAction(type: AdminEditType, action: string) {
  const entry = actionsFor(type).find((candidate) => candidate.action === action);
  if (!entry) {
    throw new McpToolError(
      `Refused: "${action}" is not an edit action for a ${ADMIN_EDIT_LABELS[type]}. Publishing, ` +
        "deleting the item itself, AI tools and anything about money stay in the admin panel. " +
        "Call content_edit_actions for the list."
    );
  }
  return entry;
}

export async function listContentEditActions(adminId: number, typeArg: unknown) {
  const type = requireType(typeArg);
  await requireEditor(adminId, type);
  return { type, actions: actionsFor(type) };
}

export async function describeContentEditAction(adminId: number, typeArg: unknown, action: string) {
  const type = requireType(typeArg);
  await requireEditor(adminId, type);
  requireAction(type, action);
  const described = describeTeacherAction(action);
  return {
    ...described,
    input:
      described.kind === "read"
        ? "Pass these as content_edit input; they are sent as query parameters."
        : "Pass this as content_edit input. Dates are ISO 8601 strings.",
  };
}

export async function callContentEdit(
  adminId: number,
  typeArg: unknown,
  id: number,
  action: string,
  input: Record<string, unknown> | undefined,
  confirm: boolean
): Promise<unknown> {
  const type = requireType(typeArg);
  const admin = await requireEditor(adminId, type);
  const entry = requireAction(type, action);
  if (entry.requiresConfirm && !confirm) {
    throw new McpToolError(
      `Refused: ${action} removes content. Show the user exactly what will be removed, then call ` +
        "again with confirm: true once they approve."
    );
  }

  const session = await openAdminEditSession(admin.id, type, id, SESSION_MINUTES);
  if (!session.ok) throw new McpToolError(session.error);
  try {
    const adminToken = await createAdminSessionToken(admin, `${SESSION_MINUTES}m`);
    const result = await invokeTeacherAction(action, input, {
      authorization: `Bearer ${session.token}`,
      cookie: `admin_session=${adminToken}`,
    });
    if (entry.kind === "write") {
      console.log(`Admin ${admin.id} ran ${action} via MCP on ${type} ${id} (teacher ${session.teacher.id})`);
    }
    return result;
  } finally {
    await closeAdminEditSession(session.sessionId);
  }
}