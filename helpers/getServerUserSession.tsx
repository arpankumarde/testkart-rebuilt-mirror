import { db } from "./db";
import { User } from "./User";
import { TeacherRoleContext } from "./getTeacherContext";

import {
  CleanupProbability,
  getServerSessionOrThrow,
  NotAuthenticatedError,
  SessionExpirationSeconds,
} from "./getSetServerSession";

export async function getServerUserSession(request: Request) {
  const session = await getServerSessionOrThrow(request);

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
