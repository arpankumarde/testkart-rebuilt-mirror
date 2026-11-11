import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./cancel_POST.schema";
import { returnCredit } from "../../../helpers/livePackages";
import { actorStamp, recordSessionEvent, type LiveActor } from "../../../helpers/liveSessionLifecycle";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const actor: LiveActor = { type: "admin", id: admin.id, label: admin.fullName ?? admin.email ?? String(admin.id) };
    const now = new Date();

    if (input.kind === "booking") {
      await db.transaction().execute(async (trx) => {
        const updated = await trx
          .updateTable("mentorshipBookings")
          .set({
            status: "cancelled",
            cancellationReason: input.reason,
            cancelledAt: now,
            cancelledBy: actorStamp(actor),
            earningStatus: "void",
            updatedAt: now,
          })
          .where("id", "=", input.id)
          .where("status", "=", "scheduled")
          .returning(["creditId", "scheduledAt", "durationMinutes"])
          .executeTakeFirst();

        if (!updated) {
          throw new Error("This booking was not found, or is no longer scheduled.");
        }
        // A paid trial or package class is given back to the student.
        if (updated.creditId) await returnCredit(trx, updated.creditId);
        await recordSessionEvent(trx, {
          kind: "booking",
          id: input.id,
          from: "scheduled",
          to: "cancelled",
          actor,
          reason: input.reason,
        });
      });
    } else {
      await db.transaction().execute(async (trx) => {
        const lesson = await trx
          .selectFrom("groupLessons")
          .select(["status", "startTime", "durationMinutes"])
          .where("id", "=", input.id)
          .forUpdate()
          .executeTakeFirst();
        if (!lesson || lesson.status === "cancelled") {
          throw new Error("This group lesson was not found, or is already cancelled.");
        }
        await trx
          .updateTable("groupLessons")
          .set({
            status: "cancelled",
            cancellationReason: input.reason,
            cancelledAt: now,
            cancelledBy: actorStamp(actor),
            updatedAt: now,
          })
          .where("id", "=", input.id)
          .execute();
        await recordSessionEvent(trx, {
          kind: "group",
          id: input.id,
          from: lesson.status,
          to: "cancelled",
          actor,
          reason: input.reason,
        });
      });
    }

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error cancelling live lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}