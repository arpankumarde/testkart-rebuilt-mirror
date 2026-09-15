import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const withdrawals = await db
      .selectFrom("teacherWithdrawals")
      .where("teacherId", "=", effectiveTeacherId)
      .selectAll()
      .orderBy("requestedDate", "desc")
      .execute();

    const output: OutputType = {
      withdrawals: withdrawals.map((w) => ({
        ...w,
        amount: Number(w.amount),
      })),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching teacher withdrawals:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}