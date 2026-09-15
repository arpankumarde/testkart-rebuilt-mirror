import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const withdrawals = await db
      .selectFrom("studentWithdrawals")
      .where("studentId", "=", user.id)
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
    console.error("Error fetching student withdrawals:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 }
    );
  }
}