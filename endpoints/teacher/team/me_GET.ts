import { OutputType, TeamAcademy } from "./me_GET.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";

/** The signed-in teacher's own side of the team model: where they manage, and who has invited them. */
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ membership: null, invitations: [] } satisfies OutputType));
    }

    const rows = await db.
    selectFrom("teacherTeamMembers").
    innerJoin("users as owner", "owner.id", "teacherTeamMembers.teacherId").
    select([
    "teacherTeamMembers.id",
    "teacherTeamMembers.status",
    "teacherTeamMembers.createdAt",
    "owner.displayName as ownerName",
    "owner.academyName",
    "owner.avatarUrl as ownerAvatarUrl"]
    ).
    where("teacherTeamMembers.memberUserId", "=", user.id).
    where("teacherTeamMembers.status", "in", ["active", "pending"]).
    orderBy("teacherTeamMembers.createdAt", "desc").
    execute();

    const toAcademy = (row: (typeof rows)[number]): TeamAcademy => ({
      id: row.id,
      ownerName: row.ownerName,
      academyName: row.academyName,
      ownerAvatarUrl: row.ownerAvatarUrl,
      createdAt: row.createdAt
    });

    const active = rows.find((row) => row.status === "active");
    const output: OutputType = {
      membership: active ? toAcademy(active) : null,
      invitations: rows.filter((row) => row.status === "pending").map(toAcademy)
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load your team";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}