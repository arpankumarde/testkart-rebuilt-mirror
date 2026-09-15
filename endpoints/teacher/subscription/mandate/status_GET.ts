import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { OutputType } from "./status_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    const mandateStatus = await db
      .selectFrom("teacherSubscriptions")
      .where("teacherId", "=", effectiveTeacherId)
      .where("status", "=", "active")
      .where("mandateId", "is not", null)
      .select([
        "mandateId",
        "mandateStatus",
        "nextChargeDate",
        "mandateMaxAmount",
      ])
      .executeTakeFirst();

    const output: OutputType = mandateStatus
      ? {
          mandateId: mandateStatus.mandateId,
          mandateStatus: mandateStatus.mandateStatus,
          nextChargeDate: mandateStatus.nextChargeDate,
          mandateMaxAmount: mandateStatus.mandateMaxAmount,
        }
      : null;

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching mandate status:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 401,
      });
    }
    return new Response(
      superjson.stringify({ error: "Failed to fetch mandate status." }),
      { status: 500 }
    );
  }
}