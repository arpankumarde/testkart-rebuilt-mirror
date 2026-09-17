import { schema, OutputType } from "./respond_POST.schema";
import { MAX_TEAM_MANAGERS, TEAM_SEAT_STATUSES } from "./invite_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";

class TeamResponseError extends Error {}

/** An invited teacher accepts or declines an invitation to manage another academy. */
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teacher accounts can join a team." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { invitationId, accept } = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      const invitation = await trx.
      selectFrom("teacherTeamMembers").
      select(["id", "teacherId", "status"]).
      where("id", "=", invitationId).
      where("memberUserId", "=", user.id).
      executeTakeFirst();

      if (!invitation || invitation.status !== "pending") {
        throw new TeamResponseError("This invitation is no longer open.");
      }

      if (!accept) {
        await trx.updateTable("teacherTeamMembers").set({ status: "declined" }).where("id", "=", invitation.id).execute();
        return;
      }

      const elsewhere = await trx.
      selectFrom("teacherTeamMembers").
      select("id").
      where("memberUserId", "=", user.id).
      where("status", "=", "active").
      executeTakeFirst();

      if (elsewhere) {
        throw new TeamResponseError("You are already on another academy's team. Leave it before joining this one.");
      }

      const ownTeam = await trx.
      selectFrom("teacherTeamMembers").
      select("id").
      where("teacherId", "=", user.id).
      where("status", "in", [...TEAM_SEAT_STATUSES]).
      executeTakeFirst();

      if (ownTeam) {
        throw new TeamResponseError("You have your own team members. Remove them before joining another academy's team.");
      }

      const active = await trx.
      selectFrom("teacherTeamMembers").
      select((eb) => eb.fn.countAll<string>().as("count")).
      where("teacherId", "=", invitation.teacherId).
      where("status", "=", "active").
      executeTakeFirst();

      if (Number(active?.count ?? 0) >= MAX_TEAM_MANAGERS) {
        throw new TeamResponseError("That team is already full.");
      }

      await trx.updateTable("teacherTeamMembers").set({ status: "active" }).where("id", "=", invitation.id).execute();
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    if (error instanceof TeamResponseError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error answering team invitation:", error);
    return new Response(superjson.stringify({ error: "Could not answer the invitation. Try again." }), { status: 400 });
  }
}