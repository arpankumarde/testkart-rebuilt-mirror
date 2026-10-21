import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./override_POST.schema";
import superjson from "superjson";

/**
 * Sets (or clears) the per-cycle renewal discount snapshot directly on a
 * subscription - the same promoDuration/promoDiscountAmount fields a promo
 * code redemption writes, but settable here by hand with no promo code
 * involved. helpers/subscriptionPromoCodes.tsx's effectiveRenewalAmount reads
 * these at every renewal regardless of where they came from, so this takes
 * effect on the very next charge with no mandate changes needed.
 */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const { subscriptionId, promoDuration, promoDiscountAmount } = schema.parse(superjson.parse(await request.text()));

    const sub = await db
      .selectFrom("teacherSubscriptions")
      .select(["id", "mandateId"])
      .where("id", "=", subscriptionId)
      .executeTakeFirst();
    if (!sub) {
      throw new Error("Subscription not found.");
    }

    await db
      .updateTable("teacherSubscriptions")
      .set({
        promoDuration,
        promoDiscountAmount: promoDiscountAmount !== null ? String(promoDiscountAmount) : null,
        updatedAt: new Date(),
      })
      .where("id", "=", subscriptionId)
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("[admin/mandates/override] Failed:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to update the charge override." }),
      { status: 400 }
    );
  }
}
