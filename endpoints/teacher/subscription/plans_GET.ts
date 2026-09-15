import { db } from "../../../helpers/db";
import { OutputType } from "./plans_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const plans = await db
      .selectFrom("subscriptionPlans")
      .selectAll()
      .where("isActive", "=", true)
      .orderBy("price", "asc")
      .execute();

    const output: OutputType = plans.map((plan) => ({
      ...plan,
      price: Number(plan.price),
      platformFeePercentage: Number(plan.platformFeePercentage),
    }));

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}