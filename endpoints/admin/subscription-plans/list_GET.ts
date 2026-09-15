import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const plans = await db
      .selectFrom("subscriptionPlans")
      .selectAll()
      .orderBy("isActive", "desc")
      .orderBy("price", "asc")
      .execute();

    return new Response(superjson.stringify(plans satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch subscription plans",
      }),
      { status: 400 }
    );
  }
}