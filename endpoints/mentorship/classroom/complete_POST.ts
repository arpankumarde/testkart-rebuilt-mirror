import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";
import { completeLiveSession, markLiveSessionNoShow, type LiveActor } from "../../../helpers/liveSessionLifecycle";
import { schema, OutputType } from "./complete_POST.schema";
import superjson from "superjson";

/*
 * The teacher closes out their own session: completed, or (1:1 only) the learner did not attend.
 * Settlement of a credit-paid class is left to the sweep, which pays only when the teacher joined.
 */
export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const owner =
      input.kind === "booking"
        ? await db.selectFrom("mentorshipBookings").select("teacherId").where("id", "=", input.id).executeTakeFirst()
        : await db.selectFrom("groupLessons").select("teacherId").where("id", "=", input.id).executeTakeFirst();
    if (!owner) {
      return new Response(superjson.stringify({ error: input.kind === "booking" ? "Booking not found" : "Group lesson not found" }), {
        status: 404,
      });
    }
    const isAdmin = user.role === "admin";
    if (owner.teacherId !== effectiveTeacherId && !isAdmin) {
      return new Response(superjson.stringify({ error: "Only the teacher can mark this session's outcome." }), { status: 403 });
    }

    const actor: LiveActor = { type: isAdmin ? "admin" : "teacher", id: user.id, label: user.displayName ?? null };
    const result =
      input.kind === "booking" && input.outcome === "no_show"
        ? await markLiveSessionNoShow({ id: input.id, party: "learner", actor, settleNow: false })
        : await completeLiveSession({ kind: input.kind, id: input.id, actor, settleNow: false });

    const output: OutputType = { success: true, status: result.status, changed: result.changed };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error completing lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}