import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./cancel_POST.schema";
import { returnCredit } from "../../../helpers/livePackages";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const cancelledByLabel = `admin:${admin.fullName ?? admin.email ?? admin.id}`;

    if (input.kind === "booking") {
      await db.transaction().execute(async (trx) => {
        const updated = await trx
          .updateTable("mentorshipBookings")
          .set({
            status: "cancelled",
            cancellationReason: input.reason,
            cancelledAt: new Date(),
            cancelledBy: cancelledByLabel,
            earningStatus: "void",
            updatedAt: new Date(),
          })
          .where("id", "=", input.id)
          .where("status", "=", "scheduled")
          .returning("creditId")
          .executeTakeFirst();

        if (!updated) {
          throw new Error("This booking was not found, or is no longer scheduled.");
        }
        // A paid trial or package class is given back to the student.
        if (updated.creditId) await returnCredit(trx, updated.creditId);
      });
    } else {
      const updated = await db
        .updateTable("groupLessons")
        .set({
          status: "cancelled",
          cancellationReason: input.reason,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where("id", "=", input.id)
        .where("status", "!=", "cancelled")
        .executeTakeFirst();

      if (updated.numUpdatedRows === 0n) {
        throw new Error("This group lesson was not found, or is already cancelled.");
      }
    }

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error cancelling live lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
