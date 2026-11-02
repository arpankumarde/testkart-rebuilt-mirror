import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./purchase_POST.schema";
import superjson from "superjson";
import { getStudentAvailableBalance } from "../../../helpers/getStudentAvailableBalance";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../../helpers/getTeacherPlatformFee";
import { ensureOrderCompletionSideEffects } from "../../../helpers/ensureOrderCompletionSideEffects";
import { lockWallet } from "../../../helpers/walletLock";
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
import { sql } from "kysely";
import { assertCartNotExpired } from "../../../helpers/contentExpiryServer";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      throw new Error("Only students can make purchases using their wallet.");
    }

    const text = await request.text();
    const json = superjson.parse(text);
    const { promoCodeId, useTcoins, autoPromoCodeId, autoPromoCodeIds } = schema.parse(json);
    if (promoCodeId && useTcoins) {
      throw new Error(ONE_OFFER_MESSAGE);
    }

    const result = await db.transaction().execute(async (trx) => {
      // Held until commit, so a parallel purchase or withdrawal request sees this debit
      await lockWallet(trx, user.id);

      // 1. Cancel pending orders for this user
      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("userId", "=", user.id)
        .where("status", "=", "pending")
        .execute();

      // 2. Fetch cart items with prices
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

      // 3. Calculate total amount
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

      // 4. Teacher offers apply by themselves; the chosen coupon (if any) is priced on what is left.
      const { stack, spinApplied } = await priceCartForCheckout(trx, {
        userId: user.id,
        lines: checkoutLines(cartItems),
        chosen: promoCodeId ? { promoCodeId } : null,
        useTcoins: useTcoins ?? false,
      });
      if (!useTcoins) {
        assertAutoOffersUnchanged(autoPromoCodeIds ?? (autoPromoCodeId ? [autoPromoCodeId] : []), stack.autoOffers);
      }
      const coupons = orderCouponColumns(stack);
      const discountAmount = stack.discountAmount;
      let finalAmount = Math.max(0, totalAmount - discountAmount);

      const tcoins = await planTcoinsForOrder(trx, {
        userId: user.id,
        orderValue: totalAmount,
        amountBeforeTcoins: finalAmount,
        useTcoins: useTcoins ?? false,
        hasCoupon: coupons.promoCodeId !== null,
      });
      finalAmount = tcoins.amountToPay;

      // 5. Compute student's available balance
      const balanceInfo = await getStudentAvailableBalance(user.id, trx);
      if (balanceInfo.availableBalance < finalAmount) {
        throw new Error(`Insufficient wallet balance. You have ₹${balanceInfo.availableBalance.toFixed(2)} available but need ₹${finalAmount.toFixed(2)}.`);
      }

      const platformFeeCache = new Map<number, number>();
      const getOrFetchFee = async (teacherId: number): Promise<number> => {
        if (platformFeeCache.has(teacherId)) return platformFeeCache.get(teacherId)!;
        const fee = await getTeacherPlatformFee(teacherId, trx);
        platformFeeCache.set(teacherId, fee);
        return fee;
      };

      // 6. Create completed order
      const newOrder = await trx
        .insertInto("orders")
        .values({
          userId: user.id,
          ...getOrderClientInfo(request),
          totalAmount: finalAmount.toFixed(2),
          ...coupons,
          status: "completed",
          paymentMethod: "wallet",
          paymentTransactionId: null,
          tcoinsRedeemed: tcoins.tcoinsRedeemed,
          tcoinsCashback: tcoins.tcoinsCashback,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      // 7. Create order items
      const orderItems = await Promise.all(
        cartItems.map(async (item) => {
          let itemPrice = 0;
          if (item.mockTestId) itemPrice = parseFloat(String(item.testDiscountPrice ?? item.testPrice!));
          else if (item.courseId) itemPrice = parseFloat(String(item.coursePrice!));
          else if (item.digitalProductId) itemPrice = parseFloat(String(item.digitalProductPrice!));

          const discount = orderItemDiscount(stack, cartRowKey(item));

          let platformFeePercentage = DEFAULT_TEACHER_PLATFORM_FEE;
          if (item.mockTestId && item.testTeacherId) platformFeePercentage = await getOrFetchFee(item.testTeacherId);
          else if (item.courseId && item.courseTeacherId) platformFeePercentage = await getOrFetchFee(item.courseTeacherId);
          else if (item.digitalProductId && item.digitalProductTeacherId) platformFeePercentage = await getOrFetchFee(item.digitalProductTeacherId);

          return {
            orderId: newOrder.id,
            mockTestId: item.mockTestId || null,
            courseId: item.courseId || null,
            digitalProductId: item.digitalProductId || null,
            priceAtPurchase: itemPrice.toFixed(2),
            ...discount,
            platformFeePercentage: platformFeePercentage.toFixed(2),
          };
        })
      );

      await trx.insertInto("orderItems").values(orderItems).execute();

      // 8. Wallet transaction and promo code usage tracking
      if (finalAmount > 0) {
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

        await trx
          .insertInto("studentWalletTransactions")
          .values({
            studentId: user.id,
            transactionType: "purchase_debit",
            amount: finalAmount.toFixed(2),
            referenceId: newOrder.id,
            description: `Purchase: ${productInfo}`,
          })
          .execute();
      }

      await recordCouponUsages(trx, stack, user.id, newOrder.id);

      if (spinApplied) {
        await recordSpinRedemption(trx, spinApplied, { id: newOrder.id, userId: user.id, finalAmount, paymentMethod: "wallet" });
      }

      // 9. Side effects logic (enrollments & cleanups)
      const mockTestIds = cartItems.filter((item) => item.mockTestId !== null).map((item) => item.mockTestId!);
      const courseIds = cartItems.filter((item) => item.courseId !== null).map((item) => item.courseId!);
      const digitalProductIds = cartItems.filter((item) => item.digitalProductId !== null).map((item) => item.digitalProductId!);

      await Promise.all([
        trx.deleteFrom("cartItems").where("userId", "=", user.id).execute(),
        mockTestIds.length > 0
          ? trx
              .updateTable("mockTests")
              .set({ studentsEnrolled: sql`students_enrolled + 1` })
              .where("id", "in", mockTestIds)
              .execute()
          : Promise.resolve(),
        courseIds.length > 0
          ? trx
              .insertInto("courseEnrollments")
              .values(
                courseIds.map((courseId) => ({
                  studentId: user.id,
                  courseId,
                  enrolledAt: new Date(),
                }))
              )
              .onConflict((oc) => oc.columns(["studentId", "courseId"]).doNothing())
              .execute()
          : Promise.resolve(),
        digitalProductIds.length > 0
          ? trx
              .insertInto("digitalProductPurchases")
              .values(
                digitalProductIds.map((productId) => ({
                  studentId: user.id,
                  productId,
                  orderId: newOrder.id,
                  purchasedAt: new Date(),
                }))
              )
              .onConflict((oc) => oc.columns(["studentId", "productId"]).doNothing())
              .execute()
          : Promise.resolve(),
        digitalProductIds.length > 0
          ? trx
              .updateTable("digitalProducts")
              .set({ totalPurchases: sql`COALESCE(total_purchases, 0) + 1` })
              .where("id", "in", digitalProductIds)
              .execute()
          : Promise.resolve(),
        mockTestIds.length > 0
          ? trx
              .insertInto("mockTestEnrollments")
              .values(
                mockTestIds.map((mockTestId) => ({
                  studentId: user.id,
                  mockTestId,
                  orderId: newOrder.id,
                  enrolledAt: new Date(),
                }))
              )
              .onConflict((oc) => oc.columns(["mockTestId", "studentId"]).doNothing())
              .execute()
          : Promise.resolve(),
      ]);

      return {
        orderId: newOrder.id,
        walletBalanceAfter: balanceInfo.availableBalance - finalAmount,
        amountDeducted: finalAmount,
        tcoinsRedeemed: tcoins.tcoinsRedeemed,
        tcoinsCashback: tcoins.tcoinsCashback,
      };
    });

        // Await side effects to prevent Lambda timer leak
    await ensureOrderCompletionSideEffects(result.orderId).catch((error) => {
      console.error(`Failed to run side effects for wallet order ${result.orderId}:`, error);
    });

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Failed to process wallet purchase:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
