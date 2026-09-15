import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType, BillingDetails } from "./billing-details_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    // Billing details are private and live on the account that "owns" the
    // invoice: for teachers that's the owner account (effectiveTeacherId),
    // for students/admins it's just their own account.
    const targetUserId = user.role === "teacher" ? effectiveTeacherId : user.id;

    const row = await db
      .selectFrom("users")
      .select(["billingDetails"])
      .where("id", "=", targetUserId)
      .executeTakeFirst();

    const output: OutputType = {
      billingDetails: (row?.billingDetails as BillingDetails | null) ?? null,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching billing details:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}
