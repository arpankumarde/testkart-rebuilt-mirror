import { db } from "./db";
import { User } from "./User";
import { TeacherRoleContext } from "./getTeacherContext";
import { ADMIN_EDIT_MODULES, isAdminEditRouteAllowed, isAdminEditType } from "./adminContentEdit";
import { getAdminServerSessionOrThrow } from "./getAdminSession";
import { hasAdminModule } from "./adminPermissions";

import {
  CleanupProbability,
  getServerSessionOrThrow,
  NotAuthenticatedError,
  Session,
  SessionExpirationSeconds,
} from "./getSetServerSession";

/*
 * An admin editing session works only on its content type's routes, and only alongside the
 * signed-in admin who opened it while that admin still holds the section.
 */
async function assertAdminEditAllowed(request: Request, session: Session) {
  const type = session.adminEditType;
  if (!isAdminEditType(type) || session.impersonatorAdminId == null) {
    throw new NotAuthenticatedError();
  }
  if (!isAdminEditRouteAllowed(type, new URL(request.url).pathname)) {
    throw new NotAuthenticatedError("Not authenticated: admins can't do this from the admin editor");
  }
  let admin;
  try {
    admin = await getAdminServerSessionOrThrow(request);
  } catch {
    throw new NotAuthenticatedError();
  }
  if (admin.id !== session.impersonatorAdminId || !hasAdminModule(admin.permissions, [ADMIN_EDIT_MODULES[type]])) {
    throw new NotAuthenticatedError();
  }
}

export async function getServerUserSession(request: Request) {
  const session = await getServerSessionOrThrow(request);
  if (session.adminEditType !== undefined) {
    await assertAdminEditAllowed(request, session);
  }

  // Occasionally clean up expired sessions
  if (Math.random() < CleanupProbability * 0.01) {
    const expirationDate = new Date(
      Date.now() - SessionExpirationSeconds * 1000
    );
    try {
      await db
        .deleteFrom("sessions")
        .where("lastAccessed", "<", expirationDate)
        .execute();
    } catch (cleanupError) {
      // Log but don't fail the request if cleanup fails
      console.error("Session cleanup error:", cleanupError);
    }
  }

  // Query the sessions and users tables in a single join query
  const results = await db
    .selectFrom("sessions")
    .innerJoin("users", "sessions.userId", "users.id")
    .leftJoin("teacherTeamMembers", (join) =>
      join
        .onRef("teacherTeamMembers.memberUserId", "=", "users.id")
        .on("teacherTeamMembers.status", "=", "active")
    )
  .select([
    "sessions.id as sessionId",
    "sessions.createdAt as sessionCreatedAt",
    "sessions.lastAccessed as sessionLastAccessed",
    "sessions.impersonatorAdminId as sessionImpersonatorAdminId",
    "users.id",
    "users.email",
    "users.displayName",
    "users.role",
    "users.avatarUrl",
    "users.avatarFileId",
    "users.mobileNumber",
    "users.mobileVerified",
    "teacherTeamMembers.teacherId as teamOwnerTeacherId",
  ])
    .where("sessions.id", "=", session.id)
    .limit(1)
    .execute();

  if (results.length === 0) {
    throw new NotAuthenticatedError();
  }

  const result = results[0];
  const userRole: User["role"] = result.role;

  // Resolve teacher context if the user is a teacher
  let teacherRole: TeacherRoleContext | undefined;
  let effectiveTeacherId: number = result.id;

  if (userRole === "teacher") {
    if (result.teamOwnerTeacherId != null) {
      teacherRole = "manager";
      effectiveTeacherId = result.teamOwnerTeacherId;
    } else {
      teacherRole = "owner";
      effectiveTeacherId = result.id;
    }
  }

  const user: User = {
    id: result.id,
    email: result.email,
    displayName: result.displayName,
    avatarUrl: result.avatarUrl,
    avatarFileId: result.avatarFileId,
    role: userRole,
    mobileNumber: result.mobileNumber,
    mobileVerified: result.mobileVerified,
    ...(userRole === "teacher" && {
      teacherRole,
      actingAsTeacherId: effectiveTeacherId,
    }),
  };

  // Update the session's lastAccessed timestamp, but skip the DB write if
  // the session was accessed recently (within the last 5 minutes) to reduce
  // unnecessary DB writes on the vast majority of requests.
  const FiveMinutesMs = 5 * 60 * 1000;
  const lastAccessedMs = session.lastAccessed;
  const isRecentlyAccessed = Date.now() - lastAccessedMs < FiveMinutesMs;

  if (isRecentlyAccessed) {
    return {
      user,
      session,
      impersonatorAdminId: result.sessionImpersonatorAdminId,
      effectiveTeacherId,
      teacherRole,
    };
  }

  const now = new Date();
  await db
    .updateTable("sessions")
    .set({ lastAccessed: now })
    .where("id", "=", session.id)
    .execute();

  return {
    user,
    // make sure to update the session in cookie
    session: {
      ...session,
      lastAccessed: now.getTime(),
    },
    impersonatorAdminId: result.sessionImpersonatorAdminId,
    effectiveTeacherId,
    teacherRole,
  };
}
