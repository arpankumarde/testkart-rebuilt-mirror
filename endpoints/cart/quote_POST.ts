import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { courseEffectivePriceSql } from "../../helpers/coursePricing";
import { productEffectivePriceSql } from "../../helpers/digitalProductPricing";
import { priceCouponStack, type StackLineKind } from "../../helpers/cartCouponStack";
import { offerCoversLine } from "../../helpers/courseCouponOffer";
import { checkoutLines, loadPlatformCouponOptions, previewCartCoupons } from "../../helpers/cartCouponStackServer";
import { schema, type OutputType, type QuoteCoupon } from "./quote_POST.schema";

const itemOfKey = (key: string) => {
  const [kind, id] = key.split(":");
  return { kind: kind as StackLineKind, id: Number(id) };
};

/**
 * The cart's coupons as checkout will charge them: the automatic teacher
 * offers, the coupon the student chose on top, and every Testkart coupon they
 * could pick instead, each priced against this cart. A preview only; checkout
 * prices and locks everything again.
 */
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const cartItems = await db
      .selectFrom("cartItems")
      .leftJoin("mockTests", "cartItems.mockTestId", "mockTests.id")
      .leftJoin("courses", "cartItems.courseId", "courses.id")
      .leftJoin("digitalProducts", "cartItems.digitalProductId", "digitalProducts.id")
      .where("cartItems.userId", "=", user.id)
      .select([
        "cartItems.mockTestId",
        "cartItems.courseId",
        "cartItems.digitalProductId",
        "mockTests.price as testPrice",
        "mockTests.discountPrice as testDiscountPrice",
        "mockTests.teacherId as testTeacherId",
        courseEffectivePriceSql.as("coursePrice"),
        "courses.teacherId as courseTeacherId",
        productEffectivePriceSql.as("digitalProductPrice"),
        "digitalProducts.teacherId as digitalProductTeacherId",
      ])
      .execute();

    const lines = checkoutLines(cartItems);
    const chosenRef = input.promoCodeId ? { promoCodeId: input.promoCodeId } : input.code ? { code: input.code } : null;
    const [preview, options] = await Promise.all([
      previewCartCoupons({ userId: user.id, lines, chosen: chosenRef }),
      loadPlatformCouponOptions(user.id),
    ]);

    const teacherIds = [...new Set(preview.autoOffers.map((o) => o.teacherId))];
    const teachers = teacherIds.length
      ? await db.selectFrom("users").select(["id", "displayName"]).where("id", "in", teacherIds).execute()
      : [];
    const teacherName = new Map(teachers.map((t) => [t.id, t.displayName]));

    const coupons: QuoteCoupon[] = options.map((option) => {
      const priced = priceCouponStack({ lines, autoCandidates: preview.autoCandidates, chosen: option.chosen });
      const terms =
        option.chosen.source === "spin"
          ? {
              discountType: option.chosen.spin.discountType === "percentage" ? ("percentage" as const) : ("fixed" as const),
              discountValue: option.chosen.spin.discountValue,
              minOrderValue: option.chosen.spin.minOrderValue,
              maxDiscountAmount: option.chosen.spin.maxDiscountAmount,
            }
          : {
              discountType: option.chosen.promo.discountType,
              discountValue: option.chosen.promo.discountValue,
              minOrderValue: option.chosen.promo.minPurchaseAmount,
              maxDiscountAmount: option.chosen.promo.maxDiscountAmount,
            };
      return {
        promoCodeId: option.chosen.promo.id,
        code: option.chosen.promo.code,
        source: option.source,
        ...terms,
        categories: option.categories,
        appliesTo: option.chosen.promo.appliesTo,
        expiresAt: option.expiresAt,
        estimate: priced.chosen?.discountAmount ?? null,
        reason: priced.chosen ? null : priced.chosenError ?? "This coupon does not apply to this cart.",
      };
    });

    const autoCodeFor = (line: { kind: StackLineKind; id: number }) =>
      preview.autoOffers.find((o) => offerCoversLine(o, line))?.code ?? null;
    const output: OutputType = {
      subtotal: preview.subtotal,
      lines: preview.lines.map((line) => ({
        kind: line.kind,
        id: line.id,
        price: line.price,
        autoDiscount: line.autoDiscount,
        autoCode: line.autoDiscount > 0 ? autoCodeFor(line) : null,
        priceAfterTeacher: Math.round((line.price - line.autoDiscount) * 100) / 100,
        chosenDiscount: line.chosenDiscount,
      })),
      autoOffers: preview.autoOffers.map((o) => ({ ...o, teacherName: teacherName.get(o.teacherId) ?? null })),
      teacherDiscount: preview.teacherDiscount,
      chosen: preview.chosen
        ? {
            promoCodeId: preview.chosen.promoCodeId,
            code: preview.chosen.code,
            source: preview.chosen.source,
            discountAmount: preview.chosen.discountAmount,
            eligibleItems: preview.chosen.eligibleKeys.map(itemOfKey),
            replacesAutoOn: preview.chosen.replacesAutoOn,
            replacesAutoOnItems: preview.chosen.replacesAutoOnKeys.map(itemOfKey),
          }
        : null,
      chosenError: preview.chosenError,
      discountAmount: preview.discountAmount,
      payable: preview.payable,
      coupons,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to price cart coupons:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input" }), { status: 400 });
    }
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status: 500 });
  }
}
