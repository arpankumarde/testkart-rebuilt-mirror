import { db } from "./db";
import { User } from "./User";
import { TeacherRoleContext } from "./getTeacherContext";
import { ADMIN_EDIT_MODULES, isAdminEditRouteAllowed, isAdminEditType } from "./adminContentEdit";
import { getAdminServerSessionOrThrow } from "./getAdminSession";
import { hasAdminModule } from "./adminPermissions";
import { getAccountStatus } from "./accountStatus";

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

  // A session's user id is unique across students and teachers (both draw ids from users_id_seq),
  // so it matches at most one of the two joins.
  const rows = await db
    .selectFrom("sessions")
    .leftJoin("students", "students.id", "sessions.userId")
    .leftJoin("teachers", "teachers.id", "sessions.userId")
    .leftJoin("teacherTeamMembers", (join) =>
      join
        .onRef("teacherTeamMembers.memberUserId", "=", "teachers.id")
        .on("teacherTeamMembers.status", "=", "active")
    )
    .leftJoin("teachers as teamOwners", "teamOwners.id", "teacherTeamMembers.teacherId")
    .select([
      "sessions.id as sessionId",
      "sessions.impersonatorAdminId as sessionImpersonatorAdminId",
      "students.id as studentId",
      "students.email as studentEmail",
      "students.displayName as studentDisplayName",
      "students.avatarUrl as studentAvatarUrl",
      "students.avatarFileId as studentAvatarFileId",
      "students.mobileNumber as studentMobileNumber",
      "students.mobileVerified as studentMobileVerified",
      "students.isActive as studentIsActive",
      "students.suspensionKind as studentSuspensionKind",
      "students.suspendedUntil as studentSuspendedUntil",
      "teachers.id as teacherId",
      "teachers.email as teacherEmail",
      "teachers.displayName as teacherDisplayName",
      "teachers.avatarUrl as teacherAvatarUrl",
      "teachers.avatarFileId as teacherAvatarFileId",
      "teachers.mobileNumber as teacherMobileNumber",
      "teachers.mobileVerified as teacherMobileVerified",
      "teachers.isActive as teacherIsActive",
      "teachers.suspensionKind as teacherSuspensionKind",
      "teachers.suspendedUntil as teacherSuspendedUntil",
      "teacherTeamMembers.teacherId as teamOwnerTeacherId",
      "teamOwners.isActive as ownerIsActive",
      "teamOwners.suspensionKind as ownerSuspensionKind",
      "teamOwners.suspendedUntil as ownerSuspendedUntil",
    ])
    .where("sessions.id", "=", session.id)
    .limit(1)
    .execute();

  const row = rows[0];
  if (!row) {
    throw new NotAuthenticatedError();
  }

  let account;
  if (row.studentId != null) {
    account = {
      id: row.studentId,
      role: "student" as const,
      email: row.studentEmail,
      displayName: row.studentDisplayName!,
      avatarUrl: row.studentAvatarUrl,
      avatarFileId: row.studentAvatarFileId,
      mobileNumber: row.studentMobileNumber,
      mobileVerified: row.studentMobileVerified!,
      isActive: row.studentIsActive!,
      suspensionKind: row.studentSuspensionKind,
      suspendedUntil: row.studentSuspendedUntil,
    };
  } else if (row.teacherId != null) {
    account = {
      id: row.teacherId,
      role: "teacher" as const,
      email: row.teacherEmail,
      displayName: row.teacherDisplayName!,
      avatarUrl: row.teacherAvatarUrl,
      avatarFileId: row.teacherAvatarFileId,
      mobileNumber: row.teacherMobileNumber,
      mobileVerified: row.teacherMobileVerified!,
      isActive: row.teacherIsActive!,
      suspensionKind: row.teacherSuspensionKind,
      suspendedUntil: row.teacherSuspendedUntil,
    };
  } else {
    throw new NotAuthenticatedError();
  }

  const result = {
    ...account,
    sessionImpersonatorAdminId: row.sessionImpersonatorAdminId,
    teamOwnerTeacherId: row.teamOwnerTeacherId,
    ownerIsActive: row.ownerIsActive,
    ownerSuspensionKind: row.ownerSuspensionKind,
    ownerSuspendedUntil: row.ownerSuspendedUntil,
  };

  // Suspended or banned accounts, and team members of a suspended teacher, are signed out
  // everywhere. Admins signed in as the user (impersonation, admin editing) are let through.
  if (result.sessionImpersonatorAdminId == null) {
    const ownerBlocked =
      result.ownerIsActive != null &&
      getAccountStatus({
        isActive: result.ownerIsActive,
        suspensionKind: result.ownerSuspensionKind,
        suspendedUntil: result.ownerSuspendedUntil,
      }) !== "active";
    if (getAccountStatus(result) !== "active" || ownerBlocked) {
      throw new NotAuthenticatedError("Not authenticated: this account is suspended");
    }
  }

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
