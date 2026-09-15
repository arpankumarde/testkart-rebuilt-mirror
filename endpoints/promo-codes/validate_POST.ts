import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./validate_POST.schema";
import superjson from "superjson";
import { ZodError } from "zod";

type ItemWithType = {
  id: number;
  type: "course" | "test" | "live_test" | "bundle" | "digital_product";
  price: number;
};

export async function handle(request: Request): Promise<Response> {
  try {
        const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const { code, totalAmount } = input;

    // Convert old format to new format for internal processing
    let items: ItemWithType[] = [];
    if (input.items) {
      items = input.items;
    } else if (input.itemType && input.itemIds) {
      // For backward compatibility: distribute totalAmount equally across items
      const pricePerItem = totalAmount / input.itemIds.length;
      items = input.itemIds.map(id => ({ id, type: input.itemType!, price: pricePerItem }));
    }

    console.log("[Promo Validation] Input items:", items.map(item => ({
      id: item.id,
      type: item.type,
      price: item.price
    })));

    const promoCode = await db
      .selectFrom("promoCodes")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    if (!promoCode) {
      return new Response(
        superjson.stringify({
          valid: false,
          message: "Invalid promo code.",
        } satisfies OutputType),
        { status: 200 }
      );
    }

    if (!promoCode.isActive) {
      return new Response(
        superjson.stringify({
          valid: false,
          message: "This promo code is no longer active.",
        } satisfies OutputType),
        { status: 200 }
      );
    }

    const now = new Date();
    if (promoCode.validFrom > now || (promoCode.validUntil && promoCode.validUntil < now)) {
      return new Response(
        superjson.stringify({
          valid: false,
          message: "This promo code is not valid at this time.",
        } satisfies OutputType),
        { status: 200 }
      );
    }

    if (promoCode.usageLimit !== null && promoCode.usageCount >= promoCode.usageLimit) {
      return new Response(
        superjson.stringify({
          valid: false,
          message: "This promo code has reached its usage limit.",
        } satisfies OutputType),
        { status: 200 }
      );
    }

    if (promoCode.perUserLimit !== null) {
      const userUsage = await db
        .selectFrom("promoCodeUsages")
        .select((eb) => eb.fn.count<string>("id").as("count"))
        .where("promoCodeId", "=", promoCode.id)
        .where("userId", "=", user.id)
        .executeTakeFirst();

      if (userUsage && parseInt(userUsage.count, 10) >= promoCode.perUserLimit) {
        return new Response(
          superjson.stringify({
            valid: false,
            message: "You have already used this promo code the maximum number of times.",
          } satisfies OutputType),
          { status: 200 }
        );
      }
    }

    // Fetch teacher IDs for all items
    const eligibleItems: ItemWithType[] = [];
    const ineligibleItems: ItemWithType[] = [];

    const appliesToMapping = {
      course: "courses",
      test: "tests",
      live_test: "live_tests",
      bundle: "bundles",
      digital_product: "digital_products",
    };

    for (const item of items) {
      let teacherId: number | null = null;

      // Fetch teacherId based on item type
      if (item.type === "course") {
        const course = await db
          .selectFrom("courses")
          .select("teacherId")
          .where("id", "=", item.id)
          .executeTakeFirst();
        teacherId = course?.teacherId ?? null;
      } else if (item.type === "test") {
        const mockTest = await db
          .selectFrom("mockTests")
          .select("teacherId")
          .where("id", "=", item.id)
          .executeTakeFirst();
        teacherId = mockTest?.teacherId ?? null;
      } else if (item.type === "live_test") {
        const liveTest = await db
          .selectFrom("liveTests")
          .select("teacherId")
          .where("id", "=", item.id)
          .executeTakeFirst();
        teacherId = liveTest?.teacherId ?? null;
      } else if (item.type === "bundle") {
        const courseBundle = await db
          .selectFrom("courseBundles")
          .select("teacherId")
          .where("id", "=", item.id)
          .executeTakeFirst();
        teacherId = courseBundle?.teacherId ?? null;
      } else if (item.type === "digital_product") {
        const digitalProduct = await db
          .selectFrom("digitalProducts")
          .select("teacherId")
          .where("id", "=", item.id)
          .executeTakeFirst();
        teacherId = digitalProduct?.teacherId ?? null;
      }

      // Check eligibility criteria
      let isEligible = true;

      // 1. Check teacher ownership
      if (promoCode.createdByTeacherId !== null && teacherId !== promoCode.createdByTeacherId) {
        isEligible = false;
      }

      // 2. Check appliesTo filter
      const dbAppliesTo = appliesToMapping[item.type];
      if (promoCode.appliesTo !== "all" && promoCode.appliesTo !== dbAppliesTo) {
        isEligible = false;
      }

      // 3. Check targetItemIds if specified
      if (promoCode.targetItemIds && promoCode.targetItemIds.length > 0) {
        if (!promoCode.targetItemIds.includes(item.id)) {
          isEligible = false;
        }
      }

      if (isEligible) {
        eligibleItems.push(item);
      } else {
        ineligibleItems.push(item);
      }
    }

    console.log("[Promo Validation] Eligible items:", eligibleItems.map(item => ({
      id: item.id,
      type: item.type,
      price: item.price
    })));
    console.log("[Promo Validation] Ineligible items:", ineligibleItems.map(item => ({
      id: item.id,
      type: item.type,
      price: item.price
    })));

    // If no items are eligible
    if (eligibleItems.length === 0) {
      return new Response(
        superjson.stringify({
          valid: false,
          eligibleItemIds: [],
          ineligibleItemIds: ineligibleItems.map(i => i.id),
          message: "This promo code is not valid for any items in your cart.",
          discountBreakdown: "Applied to 0 out of " + items.length + " items in cart",
        } satisfies OutputType),
        { status: 200 }
      );
    }

    // Calculate eligible items total by summing actual prices
    const eligibleAmount = eligibleItems.reduce((sum, item) => sum + item.price, 0);

    console.log("[Promo Validation] Eligible amount:", eligibleAmount);

    // Check minimum purchase amount on eligible items only
    if (promoCode.minPurchaseAmount !== null && eligibleAmount < parseFloat(promoCode.minPurchaseAmount)) {
      return new Response(
        superjson.stringify({
          valid: false,
          eligibleItemIds: eligibleItems.map(i => i.id),
          ineligibleItemIds: ineligibleItems.map(i => i.id),
          message: `A minimum purchase of ₹${promoCode.minPurchaseAmount} is required for eligible items.`,
          discountBreakdown: `Applied to ${eligibleItems.length} out of ${items.length} items, but minimum purchase not met`,
        } satisfies OutputType),
        { status: 200 }
      );
    }

    // Calculate discount on eligible items only
    let discountAmount = 0;
    if (promoCode.discountType === "fixed") {
      discountAmount = parseFloat(promoCode.discountValue);
    } else if (promoCode.discountType === "percentage") {
      discountAmount = (eligibleAmount * parseFloat(promoCode.discountValue)) / 100;
      if (promoCode.maxDiscountAmount !== null) {
        discountAmount = Math.min(discountAmount, parseFloat(promoCode.maxDiscountAmount));
      }
    }

    discountAmount = Math.min(discountAmount, eligibleAmount);
    discountAmount = Math.round(discountAmount * 100) / 100; // Round to 2 decimal places

    console.log("[Promo Validation] Final discount calculation:", {
      promoCodeType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      maxDiscountAmount: promoCode.maxDiscountAmount,
      calculatedDiscount: discountAmount,
      eligibleAmount: eligibleAmount
    });

    const discountBreakdown = eligibleItems.length === items.length
      ? `Applied to all ${items.length} items in cart`
      : `Applied to ${eligibleItems.length} out of ${items.length} items in cart`;

    return new Response(
      superjson.stringify({
        valid: true,
        discountAmount,
        eligibleItemIds: eligibleItems.map(i => i.id),
        ineligibleItemIds: ineligibleItems.map(i => i.id),
        promoCodeId: promoCode.id,
        message: "Promo code applied successfully!",
        discountBreakdown,
      } satisfies OutputType),
      { status: 200 }
    );
  } catch (error) {
    console.error("Promo code validation error:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input", details: error.issues }), { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to validate promo code", details: errorMessage }), { status: 500 });
  }
}