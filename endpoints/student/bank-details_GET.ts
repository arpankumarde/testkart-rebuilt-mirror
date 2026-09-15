import { OutputType } from "./bank-details_GET.schema";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can access bank details." }),
        { status: 403 }
      );
    }

    const bankDetails = await db
      .selectFrom("studentBankDetails")
      .selectAll()
      .where("studentId", "=", user.id)
      .executeTakeFirst();

    return new Response(superjson.stringify(bankDetails ?? null));
  } catch (error) {
    console.error("Error fetching student bank details:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 }
    );
  }
}