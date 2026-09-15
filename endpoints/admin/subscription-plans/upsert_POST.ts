import { schema, OutputType } from "./upsert_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    let result;
    if (input.id) {
      const existing = await db
        .selectFrom("subscriptionPlans")
        .select("price")
        .where("id", "=", input.id)
        .executeTakeFirst();

      if (!existing) {
        throw new Error("Plan not found");
      }

      if (parseFloat(existing.price as string) === 0 && parseFloat(input.price) !== 0) {
        throw new Error("Cannot change the price of the Free Plan.");
      }

      result = await db
        .updateTable("subscriptionPlans")
        .set({
          name: input.name,
          description: input.description,
          price: input.price,
          durationDays: input.durationDays,
          billingCycle: input.billingCycle,
          platformFeePercentage: input.platformFeePercentage,
          features: input.features || null,
          isActive: input.isActive,
        })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      if (parseFloat(input.price) === 0) {
        throw new Error("Cannot create a new plan with a price of 0. A Free Plan already exists.");
      }

      result = await db
        .insertInto("subscriptionPlans")
        .values({
          name: input.name,
          description: input.description,
          price: input.price,
          durationDays: input.durationDays,
          billingCycle: input.billingCycle,
          platformFeePercentage: input.platformFeePercentage,
          features: input.features || null,
          isActive: input.isActive,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Failed to upsert plan",
      }),
      { status: 400 }
    );
  }
}