import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getLiveTeachingState } from "../../../helpers/liveTeachingServer";
import { canApplyFromStatus } from "../../../helpers/liveTeachingRules";
import { OutputType } from "./apply_POST.schema";

/* Sends the teacher's live teaching application to the admin queue once every checklist item is done. */
export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" || user.teacherRole === "manager") {
      return new Response(superjson.stringify({ error: "Only the account owner can apply." }), { status: 403 });
    }

    const state = await getLiveTeachingState(effectiveTeacherId);
    if (!state) {
      return new Response(superjson.stringify({ error: "Teacher not found" }), { status: 404 });
    }
    if (!canApplyFromStatus(state.status)) {
      return new Response(
        superjson.stringify({
          error: state.status === "pending" ? "Your application is already in review." : "You are already approved.",
        }),
        { status: 400 }
      );
    }
    const missing = state.checklist.filter((item) => !item.done).map((item) => item.label);
    if (missing.length > 0) {
      return new Response(superjson.stringify({ error: `Finish these first: ${missing.join(", ")}.` }), {
        status: 400,
      });
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("liveTeachingApplications")
        .values({
          teacherId: effectiveTeacherId,
          status: "pending",
          introVideoUrl: state.introVideoUrl!,
          introVideoFileId: state.introVideoFileId,
          ratePerUnit: state.ratePerUnit !== null ? state.ratePerUnit.toFixed(2) : null,
        })
        .execute();
      await trx
        .updateTable("teachers")
        .set({ liveTeachingStatus: "pending", mentorshipEnabled: false })
        .where("id", "=", effectiveTeacherId)
        .execute();
    });

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error submitting live teaching application:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}