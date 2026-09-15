import { OutputType } from "./bank-details_GET.schema";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can access bank details." }),
        { status: 403 }
      );
    }

    const bankDetails = await db
      .selectFrom("teacherBankDetails")
      .selectAll()
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    const response: OutputType = bankDetails ?? null;

    return new Response(superjson.stringify(response));
  } catch (error) {
    console.error("Error fetching teacher bank details:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}