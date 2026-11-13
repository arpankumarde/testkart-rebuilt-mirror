import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { countPromoCodeUses } from "../../../helpers/promoCodeUsage";
import { schema, OutputType } from "./reactivate_POST.schema";
import superjson from "superjson";
import { ZodError } from "zod";

/** A refusal the teacher can act on; sent with its own message and status. */
class PromoCodeRefusal extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const istDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/*
 * Turns a deactivated code back on. Only the isActive flag changes; the code
 * keeps its dates, limits and scope, and checkout (promo-codes/validate) still
 * applies all of them. A code that has ended or used up its limit is refused
 * here, so reactivating never looks like it worked when students still could
 * not use the code - the teacher fixes the dates or limit in Edit first.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { promoCodeId } = schema.parse(json);

    const promoCode = await db
      .selectFrom("promoCodes")
      .select(["id", "code", "createdByTeacherId", "isActive", "validFrom", "validUntil", "usageLimit"])
      .where("id", "=", promoCodeId)
      .executeTakeFirst();

    if (!promoCode) {
      throw new PromoCodeRefusal("Promo code not found", 404);
    }

    if (promoCode.createdByTeacherId !== effectiveTeacherId) {
      throw new PromoCodeRefusal("You do not own this promo code", 403);
    }

    if (promoCode.isActive) {
      throw new PromoCodeRefusal(`${promoCode.code} is already active.`, 409);
    }

    const now = new Date();
    if (promoCode.validUntil && promoCode.validUntil <= now) {
      throw new PromoCodeRefusal(
        `${promoCode.code} ended on ${istDate.format(promoCode.validUntil)}. Set a later end date in Edit, then reactivate it.`,
        400
      );
    }

    if (promoCode.usageLimit !== null && (await countPromoCodeUses(db, promoCode.id)) >= promoCode.usageLimit) {
      throw new PromoCodeRefusal(
        `All ${promoCode.usageLimit} uses of ${promoCode.code} are taken. Raise the usage limit in Edit, then reactivate it.`,
        400
      );
    }

    // The isActive guard keeps two clicks from both reporting success.
    const reactivated = await db
      .updateTable("promoCodes")
      .set({ isActive: true, updatedAt: now })
      .where("id", "=", promoCodeId)
      .where("isActive", "=", false)
      .returningAll()
      .executeTakeFirst();

    if (!reactivated) {
      throw new PromoCodeRefusal(`${promoCode.code} is already active.`, 409);
    }

    const message =
      reactivated.validFrom > now
        ? `${reactivated.code} is active again. Students can use it from ${istDate.format(reactivated.validFrom)}.`
        : `${reactivated.code} is active again. Students can apply it at checkout now.`;

    return new Response(
      superjson.stringify({ success: true, message, promoCode: reactivated } satisfies OutputType),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof PromoCodeRefusal) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Failed to reactivate promo code:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input", details: error.issues }), { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to reactivate promo code", details: errorMessage }), { status: 500 });
  }
}