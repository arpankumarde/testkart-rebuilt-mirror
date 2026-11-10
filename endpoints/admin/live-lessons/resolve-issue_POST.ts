import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { returnCredit } from "../../../helpers/livePackages";
import { sendClassRefundedEmail } from "../../../helpers/livePackageEmails";
import { schema, OutputType } from "./resolve-issue_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const { bookingId, resolution } = schema.parse(superjson.parse(await request.text()));

    const outcome = await db.transaction().execute(async (trx) => {
      const b = await trx
        .selectFrom("mentorshipBookings")
        .select(["creditId", "issueReportedAt", "issueResolution"])
        .where("id", "=", bookingId)
        .forUpdate()
        .executeTakeFirst();
      if (!b || !b.issueReportedAt) throw new Error("No report on this class.");
      if (b.issueResolution) throw new Error("This report is already settled.");

      await trx
        .updateTable("mentorshipBookings")
        .set({
          issueResolution: resolution,
          issueResolvedAt: new Date(),
          ...(resolution === "refunded" ? { earningStatus: "void" as const } : {}),
          updatedAt: new Date(),
        })
        .where("id", "=", bookingId)
        .execute();
      if (resolution !== "refunded" || !b.creditId) return null;
      return returnCredit(trx, b.creditId);
    });

    if (outcome) await sendClassRefundedEmail(bookingId, outcome);
    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Resolve live issue failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Could not settle the report." }), { status: 400 });
  }
}
