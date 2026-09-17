import { OutputType } from "./leave_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";

/** A manager leaves the academy they manage and is back on their own account. */
export async function handle(request: Request) {
  try {
    const { user, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" || teacherRole !== "manager") {
      return new Response(superjson.stringify({ error: "You are not on anyone's team." }), { status: 400 });
    }

    await db.updateTable("teacherTeamMembers").
    set({ status: "left" }).
    where("memberUserId", "=", user.id).
    where("status", "=", "active").
    execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to leave the team.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}