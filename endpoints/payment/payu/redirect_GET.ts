import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { PAYU_MODE } from "../../../helpers/_publicConfigs";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { sql } from "kysely";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../../helpers/getTeacherPlatformFee";
import { ensureOrderCompletionSideEffects } from "../../../helpers/ensureOrderCompletionSideEffects";
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
import { assertCartNotExpired } from "../../../helpers/contentExpiryServer";

const generateErrorHtml = (errorMessage: string, backUrl: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Error</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f4f4f4; color: #333; text-align: center; }
        .container { padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #d9534f; }
        p { margin-bottom: 1.5rem; }
        a { display: inline-block; padding: 0.75rem 1.5rem; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; transition: background-color 0.2s; }
        a:hover { background-color: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Oops! Something went wrong.</h1>
        <p>${errorMessage}</p>
        <a href="${backUrl}">Go Back to Cart</a>
    </div>
</body>
</html>
`;

const generateFreeOrderRedirectHtml = (redirectUrl: string) => `<!DOCTYPE html>
<html>
<head>
    <title>Order Complete</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f9f9f9; }
        .loading-container { text-align: center; color: #555; }
        .spinner { width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #22c55e; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        p { margin: 5px 0; font-size: 1.1rem; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="spinner"></div>
        <p>Order completed! Redirecting...</p>
    </div>
    <script>
        window.location.href = ${JSON.stringify(redirectUrl)};
    </script>
</body>
</html>
`;

const escapeHtmlAttr = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const generateRedirectHtml = (formData: { [key: string]: string }) => {
  const { payuUrl, ...payuFields } = formData;
  const hiddenInputs = Object.entries(payuFields)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${escapeHtmlAttr(value)}" />`)
    .join("\n        ");

  return `<!DOCTYPE html>
<html>
<head>
    <title>Redirecting to Payment Gateway...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f9f9f9; }
        .loading-container { text-align: center; color: #555; }
        .spinner { width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        p { margin: 5px 0; font-size: 1.1rem; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="spinner"></div>
        <p>Redirecting to our secure payment gateway...</p>
        <p>Please do not refresh or press back.</p>
    </div>
    <form id="payuForm" method="POST" action="${escapeHtmlAttr(payuUrl)}">
        ${hiddenInputs}
    </form>
    <script>
        document.getElementById('payuForm').submit();
    </script>
</body>
</html>
`;
};

export async function handle(request: Request) {
  const baseUrl = "https://testkart.in";
  try {
    const { user } = await getServerUserSession(request);

    // Parse query parameters
    const url = new URL(request.url);
    const promoCodeIdParam = url.searchParams.get("promoCodeId");
    const promoCodeId = promoCodeIdParam ? parseInt(promoCodeIdParam, 10) : null;
    const useTcoins = url.searchParams.get("useTcoins") === "1";
    const autoPromoCodeIdParam = url.searchParams.get("autoPromoCodeId");
    const autoPromoCodeId = autoPromoCodeIdParam ? parseInt(autoPromoCodeIdParam, 10) : null;
    // The teacher offers the cart showed; autoPromoCodeId is the older single-offer form.
    const autoPromoCodeIdsParam = url.searchParams.get("autoPromoCodeIds");
    const expectedAutoOfferIds = autoPromoCodeIdsParam
      ? autoPromoCodeIdsParam.split(",").map((id) => parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0)
      : autoPromoCodeId
        ? [autoPromoCodeId]
        : [];

    // Validate promoCodeId if provided
    if (promoCodeIdParam && (isNaN(promoCodeId!) || promoCodeId! <= 0)) {
      const errorHtml = generateErrorHtml("Invalid promo code parameter.", "/cart");
      return new Response(errorHtml, { status: 400, headers: { "Content-Type": "text/html" } });
    }
    if (autoPromoCodeIdParam && (autoPromoCodeId === null || isNaN(autoPromoCodeId) || autoPromoCodeId < 0)) {
      const errorHtml = generateErrorHtml("Invalid offer parameter.", "/cart");
      return new Response(errorHtml, { status: 400, headers: { "Content-Type": "text/html" } });
    }
    if (promoCodeId && useTcoins) {
      const errorHtml = generateErrorHtml(ONE_OFFER_MESSAGE, "/cart");
      return new Response(errorHtml, { status: 400, headers: { "Content-Type": "text/html" } });
    }

    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      console.error("PayU merchant key or salt is not configured.");
      const errorHtml = generateErrorHtml("Payment gateway is not configured. Please contact support.", "/cart");
      return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html" } });
    }

    // Use a union type to distinguish between paid and free order results
    type PaidOrderResult = { kind: 'paid'; formData: { [key: string]: string } };
    type FreeOrderResult = { kind: 'free'; orderId: number };
    type TransactionResult = PaidOrderResult | FreeOrderResult;

    const result = await db.transaction().execute(async (trx): Promise<TransactionResult> => {
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
          return sum + parseFloat(String(item.testDiscountPrice ?? item.testPrice!));
        } else if (item.courseId) {
          return sum + parseFloat(String(item.coursePrice!));
        } else if (item.digitalProductId) {
          return sum + parseFloat(String(item.digitalProductPrice!));
        }
        return sum;
      }, 0);

      // Teacher offers apply by themselves; the chosen coupon (if any) is priced on what is left.
      const { stack, spinApplied } = await priceCartForCheckout(trx, {
        userId: user.id,
        lines: checkoutLines(cartItems),
        chosen: promoCodeId ? { promoCodeId } : null,
        useTcoins,
      });
      if (!useTcoins) {
        assertAutoOffersUnchanged(expectedAutoOfferIds, stack.autoOffers);
      }
      const coupons = orderCouponColumns(stack);
      const discountAmount = stack.discountAmount;
      let finalAmount = Math.max(0, totalAmount - discountAmount);

      const tcoins = await planTcoinsForOrder(trx, {
        userId: user.id,
        orderValue: totalAmount,
        amountBeforeTcoins: finalAmount,
        useTcoins,
        hasCoupon: coupons.promoCodeId !== null,
      });
      finalAmount = tcoins.amountToPay;

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

      // -----------------------------------------------------------------------
      // ZERO-TOTAL PATH: Handle free orders without involving PayU
      // -----------------------------------------------------------------------
      if (finalAmount <= 0) {
        console.log(`[redirect_GET] Zero-total order for user ${user.id}. Processing as free order.`);

        const newOrder = await trx
          .insertInto("orders")
          .values({
            userId: user.id,
            ...getOrderClientInfo(request),
            totalAmount: "0.00",
            ...coupons,
            status: "completed",
            paymentMethod: "free",
            paymentTransactionId: null,
            tcoinsRedeemed: tcoins.tcoinsRedeemed,
            tcoinsCashback: tcoins.tcoinsCashback,
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        const orderItems = await Promise.all(cartItems.map(async (item) => {
          let itemPrice = 0;
          if (item.mockTestId) {
            itemPrice = parseFloat(String(item.testDiscountPrice ?? item.testPrice!));
          } else if (item.courseId) {
            itemPrice = parseFloat(String(item.coursePrice!));
          } else if (item.digitalProductId) {
            itemPrice = parseFloat(String(item.digitalProductPrice!));
          }

          const discount = orderItemDiscount(stack, cartRowKey(item));

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
            mockTestId: item.mockTestId || null,
            courseId: item.courseId || null,
            digitalProductId: item.digitalProductId || null,
            priceAtPurchase: itemPrice.toFixed(2),
            ...discount,
            platformFeePercentage: platformFeePercentage.toFixed(2),
          };
        }));

        await trx.insertInto("orderItems").values(orderItems).execute();

        await recordCouponUsages(trx, stack, user.id, newOrder.id);

        if (spinApplied) {
          await recordSpinRedemption(trx, spinApplied, { id: newOrder.id, userId: user.id, finalAmount: 0, paymentMethod: "free" });
        }

        const mockTestIds = cartItems
          .filter(item => item.mockTestId !== null)
          .map(item => item.mockTestId!);
        const courseIds = cartItems
          .filter(item => item.courseId !== null)
          .map(item => item.courseId!);
        const digitalProductIds = cartItems
          .filter(item => item.digitalProductId !== null)
          .map(item => item.digitalProductId!);

        await Promise.all([
          // Clear the cart
          trx.deleteFrom("cartItems").where("userId", "=", user.id).execute(),
          // Increment studentsEnrolled for mock tests
          mockTestIds.length > 0
            ? trx
                .updateTable("mockTests")
                .set({ studentsEnrolled: sql`students_enrolled + 1` })
                .where("id", "in", mockTestIds)
                .execute()
            : Promise.resolve(),
          // Create course enrollments
          courseIds.length > 0
            ? trx
                .insertInto("courseEnrollments")
                .values(courseIds.map(courseId => ({
                  studentId: user.id,
                  courseId,
                  enrolledAt: new Date(),
                })))
                .onConflict(oc => oc.columns(["studentId", "courseId"]).doNothing())
                .execute()
            : Promise.resolve(),
          // Create mock test enrollments
          mockTestIds.length > 0
            ? trx
                .insertInto("mockTestEnrollments")
                .values(mockTestIds.map(mockTestId => ({
                  studentId: user.id,
                  mockTestId,
                  orderId: newOrder.id,
                  enrolledAt: new Date(),
                })))
                .onConflict(oc => oc.columns(["mockTestId", "studentId"]).doNothing())
                .execute()
            : Promise.resolve(),
          // Create digital product purchases
          digitalProductIds.length > 0
            ? trx
                .insertInto("digitalProductPurchases")
                .values(digitalProductIds.map(productId => ({
                  studentId: user.id,
                  productId,
                  orderId: newOrder.id,
                  purchasedAt: new Date(),
                })))
                .onConflict(oc => oc.columns(["studentId", "productId"]).doNothing())
                .execute()
            : Promise.resolve(),
          // Increment totalPurchases for digital products
          digitalProductIds.length > 0
            ? trx
                .updateTable("digitalProducts")
                .set((eb) => ({
                  totalPurchases: eb("totalPurchases", "+", 1),
                }))
                .where("id", "in", digitalProductIds)
                .execute()
            : Promise.resolve(),
        ]);

        console.log(`[redirect_GET] Free order ${newOrder.id} completed for user ${user.id}.`);
        return { kind: 'free', orderId: newOrder.id };
      }

      // -----------------------------------------------------------------------
      // PAID PATH: Generate PayU form data
      // -----------------------------------------------------------------------

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

      const orderItems = await Promise.all(cartItems.map(async (item) => {
        let itemPrice = 0;
        if (item.mockTestId) {
          itemPrice = parseFloat(String(item.testDiscountPrice ?? item.testPrice!));
        } else if (item.courseId) {
          itemPrice = parseFloat(String(item.coursePrice!));
        } else if (item.digitalProductId) {
          itemPrice = parseFloat(String(item.digitalProductPrice!));
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
          mockTestId: item.mockTestId || null,
          courseId: item.courseId || null,
          digitalProductId: item.digitalProductId || null,
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

      console.log(`PayU hash fields - key: ${PAYU_MERCHANT_KEY}, txnid: ${txnid}, amount: ${amount}, productinfo: "${sanitizedProductInfo}"`);

      const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${sanitizedProductInfo}|${firstname}|${email}|||||||||||${PAYU_MERCHANT_SALT}`;
      const hash = createHash("sha512").update(hashString).digest("hex");

      const payuUrl =
        PAYU_MODE !== "production"
          ? "https://test.payu.in/_payment"
          : "https://secure.payu.in/_payment";

      return {
        kind: 'paid' as const,
        formData: {
          key: PAYU_MERCHANT_KEY,
          txnid,
          amount,
          productinfo: sanitizedProductInfo,
          firstname,
          email,
          phone: user.mobileNumber || "9999999999",
          surl: `${baseUrl}/_api/payment/payu/callback`,
          furl: `${baseUrl}/_api/payment/payu/callback`,
          hash,
          payuUrl,
        },
      };
    });

    if (result.kind === 'free') {
            // Await side effects to prevent Lambda timer leak
      await ensureOrderCompletionSideEffects(result.orderId).catch((error) => {
        console.error(`[redirect_GET] Failed to run side effects for free order ${result.orderId}:`, error);
      });

      const html = generateFreeOrderRedirectHtml(
        `${baseUrl}/student/dashboard?order_id=${result.orderId}&free=true`
      );
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    const html = generateRedirectHtml(result.formData);
    return new Response(html, { headers: { "Content-Type": "text/html" } });

  } catch (error) {
    console.error("Failed to initiate payment redirect:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const errorHtml = generateErrorHtml(`Failed to initiate payment: ${errorMessage}`, "/cart");
    return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html" } });
  }
}
