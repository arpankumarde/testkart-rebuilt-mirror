import { schema, OutputType } from "./remove_POST.schema";
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

    // Only account owners can remove team members
    requireOwnerRole(teacherRole);

    const json = superjson.parse(await request.text());
    const { memberUserId } = schema.parse(json);

    // Removes an active member or cancels a pending invite. A removed member is
    // signed out so their next sign-in starts on their own account.
    const removed = await db.transaction().execute(async (trx) => {
      const row = await trx.selectFrom("teacherTeamMembers").
      select(["id", "status"]).
      where("teacherId", "=", effectiveTeacherId).
      where("memberUserId", "=", memberUserId).
      where("status", "in", ["active", "pending"]).
      executeTakeFirst();

      if (!row) return false;

      await trx.updateTable("teacherTeamMembers").set({ status: "revoked" }).where("id", "=", row.id).execute();
      if (row.status === "active") {
        await trx.deleteFrom("sessions").where("userId", "=", memberUserId).execute();
      }
      return true;
    });

    if (!removed) {
      return new Response(superjson.stringify({ error: "Team member not found or already removed." }), { status: 400 });
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove team member.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}