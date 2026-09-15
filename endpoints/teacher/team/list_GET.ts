import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import { requireOwnerRole } from '../../../helpers/getTeacherContext';
import { db } from '../../../helpers/db';

export async function handle(request: Request) {
  try {
    const { user, teacherRole, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" || !teacherRole) {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Only account owners can view the team list
    requireOwnerRole(teacherRole);

    const members = await db.
    selectFrom("teacherTeamMembers").
    innerJoin("users", "users.id", "teacherTeamMembers.memberUserId").
    select([
    "teacherTeamMembers.id",
    "teacherTeamMembers.memberUserId",
    "users.displayName",
    "users.mobileNumber",
    "users.avatarUrl",
    "teacherTeamMembers.invitedPhone",
    "teacherTeamMembers.status",
    "teacherTeamMembers.role",
    "teacherTeamMembers.createdAt"]
    ).
    where("teacherTeamMembers.teacherId", "=", effectiveTeacherId).
    orderBy("teacherTeamMembers.createdAt", "desc").
    execute();

    return new Response(superjson.stringify({ members } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load team members";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}