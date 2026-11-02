import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./initiate_POST.schema";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { PAYU_MODE } from "../../../helpers/_publicConfigs";
import { sql } from "kysely";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../../helpers/getTeacherPlatformFee";
import { courseEffectivePriceSql } from "../../../helpers/coursePricing";
import { productEffectivePriceSql } from "../../../helpers/digitalProductPricing";
import { planTcoinsForOrder } from "../../../helpers/tcoins";
import { ONE_OFFER_MESSAGE } from "../../../helpers/tcoinsMath";
import { getOrderClientInfo } from "../../../helpers/orderClientInfo";
import { assertAutoOffersUnchanged } from "../../../helpers/courseCouponOffersServer";
import {
  cartRowKey,
  checkoutLines,
  orderCouponColumns,
  orderItemDiscount,
  priceCartForCheckout,
  recordCouponUsages,
} from "../../../helpers/cartCouponStackServer";
import { recordSpinRedemption } from "../../../helpers/spinWinServer";
import { assertCartNotExpired, ContentExpiryError } from "../../../helpers/contentExpiryServer";

export async function handle(request: Request) {
  try {
    // Always use production domain for PayU callback URLs
    const baseUrl = "https://testkart.in";
    const { user } = await getServerUserSession(request);
    const body = superjson.parse(await request.text());
    const input = schema.parse(body);
    if (input.promoCodeId && input.useTcoins) {
      return new Response(
        superjson.stringify({ error: "Failed to initiate payment.", details: ONE_OFFER_MESSAGE }),
        { status: 400 }
      );
    }

    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      console.error("PayU merchant key or salt is not configured.");
      throw new Error("Payment gateway is not configured.");
    }

    const orderId = await db.transaction().execute(async (trx) => {
      // Cancel any existing pending orders for this user before creating a new one.
      // This prevents accumulation of multiple pending orders when users retry payments.
      // Each payment attempt gets a fresh transaction ID, so old pending orders are no longer valid.
      // We use "cancelled" status (not "failed") to distinguish user-initiated retries from payment failures.
      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("userId", "=", user.id)
        .where("status", "=", "pending")
        .execute();

      const cartItems = await trx
        .selectFrom("cartItems")
        .leftJoin("mockTests", "cartItems.mockTestId", "mockTests.id")
        .leftJoin("courses", "cartItems.courseId", "courses.id")
        .leftJoin("digitalProducts", "cartItems.digitalProductId", "digitalProducts.id")
        .where("cartItems.userId", "=", user.id)
        .select([
          "cartItems.id as cartItemId",
          "cartItems.mockTestId",
          "cartItems.courseId",
          "cartItems.digitalProductId",
          "mockTests.title as testTitle",
          "mockTests.price as testPrice",
          "mockTests.discountPrice as testDiscountPrice",
          "mockTests.teacherId as testTeacherId",
          "courses.title as courseTitle",
          // Effective price: the discounted price when valid, else the list price.
          courseEffectivePriceSql.as("coursePrice"),
          "courses.teacherId as courseTeacherId",
          "digitalProducts.title as digitalProductTitle",
          // Effective price: the discounted price when valid, else the list price.
          productEffectivePriceSql.as("digitalProductPrice"),
          "digitalProducts.teacherId as digitalProductTeacherId",
        ])
        .execute();

      if (cartItems.length === 0) {
        throw new Error("Your cart is empty.");
      }
      await assertCartNotExpired(trx, user.id);

      // Calculate total amount for all item types
      const totalAmount = cartItems.reduce((sum, item) => {
        if (item.mockTestId) {
          return sum + parseFloat(item.testDiscountPrice || item.testPrice!);
        } else if (item.courseId) {
          return sum + parseFloat(item.coursePrice!);
        } else if (item.digitalProductId) {
          return sum + parseFloat(item.digitalProductPrice!);
        }
        return sum;
      }, 0);

      // Teacher offers apply by themselves; the chosen coupon (if any) is priced on what is left.
      const { stack, spinApplied } = await priceCartForCheckout(trx, {
        userId: user.id,
        lines: checkoutLines(cartItems),
        chosen: input.promoCodeId ? { promoCodeId: input.promoCodeId } : null,
        useTcoins: input.useTcoins ?? false,
      });
      if (!input.useTcoins) {
        assertAutoOffersUnchanged(input.autoPromoCodeIds ?? (input.autoPromoCodeId ? [input.autoPromoCodeId] : []), stack.autoOffers);
      }
      const coupons = orderCouponColumns(stack);
      const discountAmount = stack.discountAmount;
      let finalAmount = Math.max(0, totalAmount - discountAmount);

      const tcoins = await planTcoinsForOrder(trx, {
        userId: user.id,
        orderValue: totalAmount,
        amountBeforeTcoins: Math.max(0, finalAmount),
        useTcoins: input.useTcoins ?? false,
        hasCoupon: coupons.promoCodeId !== null,
      });
      finalAmount = tcoins.amountToPay;

      // Generate product info from all item types
      const productInfo = cartItems
        .map((item) => {
          if (item.mockTestId) return item.testTitle;
          if (item.courseId) return item.courseTitle;
          if (item.digitalProductId) return item.digitalProductTitle;
          return "";
        })
        .filter(Boolean)
        .join(", ")
        .substring(0, 100);

      const txnid = `testkart-${nanoid(12)}`;

      const newOrder = await trx
        .insertInto("orders")
        .values({
          userId: user.id,
          ...getOrderClientInfo(request),
          totalAmount: finalAmount.toFixed(2),
          ...coupons,
          status: "pending",
          paymentMethod: "payu",
          paymentTransactionId: txnid,
          tcoinsRedeemed: tcoins.tcoinsRedeemed,
          tcoinsCashback: tcoins.tcoinsCashback,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      // Cache platform fee per teacherId to avoid redundant DB queries
      const platformFeeCache = new Map<number, number>();
      const getOrFetchFee = async (teacherId: number): Promise<number> => {
        if (platformFeeCache.has(teacherId)) {
          return platformFeeCache.get(teacherId)!;
        }
        const fee = await getTeacherPlatformFee(teacherId, trx);
        platformFeeCache.set(teacherId, fee);
        return fee;
      };

      const orderItems = await Promise.all(cartItems.map(async (item) => {
        let itemPrice = 0;
        if (item.mockTestId) {
          itemPrice = parseFloat(item.testDiscountPrice || item.testPrice!);
        } else if (item.courseId) {
          itemPrice = parseFloat(item.coursePrice!);
        } else if (item.digitalProductId) {
          itemPrice = parseFloat(item.digitalProductPrice!);
        }

        const discount = orderItemDiscount(stack, cartRowKey(item));

        // Determine teacherId for this item and look up platform fee
        let platformFeePercentage = DEFAULT_TEACHER_PLATFORM_FEE;
        if (item.mockTestId && item.testTeacherId) {
          platformFeePercentage = await getOrFetchFee(item.testTeacherId);
        } else if (item.courseId && item.courseTeacherId) {
          platformFeePercentage = await getOrFetchFee(item.courseTeacherId);
        } else if (item.digitalProductId && item.digitalProductTeacherId) {
          platformFeePercentage = await getOrFetchFee(item.digitalProductTeacherId);
        }

        return {
          orderId: newOrder.id,
          mockTestId: item.mockTestId ?? null,
          courseId: item.courseId ?? null,
          digitalProductId: item.digitalProductId ?? null,
          priceAtPurchase: itemPrice.toFixed(2),
          ...discount,
          platformFeePercentage: platformFeePercentage.toFixed(2),
        };
      }));

      await trx.insertInto("orderItems").values(orderItems).execute();

      // Validation: Ensure sum of all item discounts equals the order-level discount
      const totalItemDiscounts = orderItems.reduce((sum, item) => sum + parseFloat(item.discountAmount), 0);
      const discountDifference = Math.abs(totalItemDiscounts - discountAmount);
      if (discountDifference > 0.01) {
        console.warn(`Discount distribution mismatch: order total ${discountAmount.toFixed(2)} vs items total ${totalItemDiscounts.toFixed(2)}`);
      }

      await recordCouponUsages(trx, stack, user.id, newOrder.id);

      if (spinApplied) {
        await recordSpinRedemption(trx, spinApplied, { id: newOrder.id, userId: user.id, finalAmount, paymentMethod: "payu" });
      }

      const amount = finalAmount.toFixed(2);
      // Normalize email once and reuse for both hash and form to avoid mismatch
      const email = user.email ?? `${user.mobileNumber}@mail.testkart.in`;
      // Sanitize firstname and productInfo: remove pipe characters as PayU uses | as delimiter
      const firstname = (user.displayName || "Student").replace(/\|/g, " ");
      const sanitizedProductInfo = productInfo.replace(/\|/g, " ");

      // udf1 carries the deep link URL for mobile app payment flow (same pattern as OAuth callback)
      const udf1 = input.deepLinkUrl ?? "";

      console.log(`PayU hash fields - key: ${PAYU_MERCHANT_KEY}, txnid: ${txnid}, amount: ${amount}, productinfo: "${sanitizedProductInfo}", udf1: "${udf1}"`);

      const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${sanitizedProductInfo}|${firstname}|${email}|${udf1}||||||||||${PAYU_MERCHANT_SALT}`;
      const hash = createHash("sha512").update(hashString).digest("hex");

      const payuUrl =
        PAYU_MODE !== "production"
          ? "https://test.payu.in/_payment"
          : "https://secure.payu.in/_payment";

      const responsePayload: OutputType = {
        key: PAYU_MERCHANT_KEY,
        txnid,
        amount,
        productinfo: sanitizedProductInfo,
        firstname,
        email,
        phone: "9999999999", // Default phone as per requirements
        surl: `https://testkart.in/_api/payment/payu/callback`,
        furl: `https://testkart.in/_api/payment/payu/callback`,
        hash,
        payuUrl,
        ...(udf1 ? { udf1 } : {}),
      };

      return responsePayload;
    });

    return new Response(superjson.stringify(orderId));
  } catch (error) {
    console.error("Failed to initiate payment:", error);
    if (error instanceof ContentExpiryError) {
      return new Response(superjson.stringify({ error: error.message, details: error.message }), { status: error.status });
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to initiate payment.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}
