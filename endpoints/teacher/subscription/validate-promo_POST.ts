import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { schema, OutputType } from "./validate-promo_POST.schema";
import superjson from "superjson";
import { validatePromoCodeForPlan, applyPromoDiscount, computePromoDiscountAmount } from "../../../helpers/subscriptionPromoCodes";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const plan = await db
      .selectFrom("subscriptionPlans")
      .selectAll()
      .where("id", "=", input.planId)
      .where("isActive", "=", true)
      .executeTakeFirst();
    if (!plan) {
      throw new Error("The selected subscription plan is not available.");
    }

    const promo = await validatePromoCodeForPlan(db, input.code, input.planId, effectiveTeacherId);

    const planPrice = Number(plan.price);
    const discountAmount = computePromoDiscountAmount(planPrice, promo);
    const finalPrice = applyPromoDiscount(planPrice, promo);

    return new Response(
      superjson.stringify({
        promoCodeId: promo.id,
        code: promo.code,
        discountAmount,
        finalPrice,
        recurringScope: (promo.recurringScope as "first_month" | "every_month") || "first_month",
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 401 });
    }
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to validate promo code" }),
      { status: 400 }
    );
  }
}
