import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./withdraw_POST.schema";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" || user.teacherRole === "manager") {
      return fail("Only the account owner can do this.", 403);
    }
    const { what } = schema.parse(superjson.parse(await request.text()));
    const now = new Date();

    const done = await db.transaction().execute(async (trx) => {
      const pulled = await trx
        .updateTable("liveTeachingApplications")
        .set({ status: "withdrawn", decidedBy: "teacher", decidedAt: now, updatedAt: now })
        .where("teacherId", "=", effectiveTeacherId)
        .where("kind", "=", what)
        .where("status", "=", "pending")
        .executeTakeFirst();
      if (Number(pulled.numUpdatedRows) === 0) return false;
      if (what === "application") {
        await trx
          .updateTable("users")
          .set({ liveTeachingStatus: "none", mentorshipEnabled: false })
          .where("id", "=", effectiveTeacherId)
          .where("liveTeachingStatus", "=", "pending")
          .execute();
      }
      return true;
    });

    if (!done) {
      return fail(what === "application" ? "There is no application in review to withdraw." : "There is no new video in review.");
    }
    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error withdrawing live teaching application:", error);
    return fail(error instanceof Error ? error.message : "An unknown error occurred");
  }
}
