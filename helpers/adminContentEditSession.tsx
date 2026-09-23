import { randomBytes } from "crypto";
import { db } from "./db";
import { createServerSessionToken } from "./getSetServerSession";
import { ADMIN_EDIT_LABELS, AdminEditType } from "./adminContentEdit";

/*
 * An admin editing session for one teacher item: a sessions row for the item's teacher with
 * impersonatorAdminId set, signed as a short-lived token that getServerUserSession limits to this
 * content type's edit routes and to the admin who opened it. Opened by the admin panel editor
 * (admin/content-edit/session) and by the admin MCP connector (helpers/mcpAdminContentEdit).
 */

export async function loadAdminEditItem(type: AdminEditType, id: number) {
  switch (type) {
    case "digital_product":
      return db
        .selectFrom("digitalProducts")
        .select(["teacherId", "title"])
        .where("id", "=", id)
        .executeTakeFirst();
    case "course_bundle":
      return db
        .selectFrom("courseBundles")
        .select(["teacherId", "title"])
        .where("id", "=", id)
        .executeTakeFirst();
    case "course":
      return db
        .selectFrom("courses")
        .select(["teacherId", "title"])
        .where("id", "=", id)
        .executeTakeFirst();
    case "live_test":
      return db
        .selectFrom("liveTests")
        .select(["teacherId", "title"])
        .where("id", "=", id)
        .executeTakeFirst();
    case "mock_test":
      return db
        .selectFrom("mockTests")
        .select(["teacherId", "title"])
        .where("id", "=", id)
        .executeTakeFirst();
  }
}

export type AdminEditSession =
  | {
      ok: true;
      sessionId: string;
      token: string;
      expiresAt: Date;
      teacher: { id: number; name: string };
      title: string;
    }
  | { ok: false; status: 404 | 409; error: string };

export async function openAdminEditSession(
  adminId: number,
  type: AdminEditType,
  id: number,
  lifetimeMinutes: number
): Promise<AdminEditSession> {
  const item = await loadAdminEditItem(type, id);
  if (!item) return { ok: false, status: 404, error: `This ${ADMIN_EDIT_LABELS[type]} no longer exists.` };

  const teacher = await db
    .selectFrom("users")
    .select(["id", "role", "displayName", "email"])
    .where("id", "=", item.teacherId)
    .executeTakeFirst();
  if (!teacher || teacher.role !== "teacher") {
    return {
      ok: false,
      status: 409,
      error: `The teacher who owns this ${ADMIN_EDIT_LABELS[type]} no longer has a teacher account.`,
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + lifetimeMinutes * 60 * 1000);
  const sessionId = randomBytes(32).toString("hex");
  await db
    .insertInto("sessions")
    .values({
      id: sessionId,
      userId: teacher.id,
      createdAt: now,
      lastAccessed: now,
      expiresAt,
      impersonatorAdminId: adminId,
    })
    .execute();

  const token = await createServerSessionToken(
    {
      id: sessionId,
      createdAt: now.getTime(),
      lastAccessed: now.getTime(),
      impersonatorAdminId: adminId,
      adminEditType: type,
    },
    `${lifetimeMinutes}m`
  );

  return {
    ok: true,
    sessionId,
    token,
    expiresAt,
    teacher: { id: teacher.id, name: teacher.displayName || teacher.email || `Teacher #${teacher.id}` },
    title: item.title,
  };
}

export async function closeAdminEditSession(sessionId: string): Promise<void> {
  await db.deleteFrom("sessions").where("id", "=", sessionId).execute();
}