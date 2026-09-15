import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./purchase_POST.schema";
import superjson from "superjson";
import { getStudentAvailableBalance } from "../../../helpers/getStudentAvailableBalance";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";
import { ensureOrderCompletionSideEffects } from "../../../helpers/ensureOrderCompletionSideEffects";
import { promoCodeCoversTeacher } from "../../../helpers/promoCodeEligibility";
import { lockWallet } from "../../../helpers/walletLock";
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      throw new Error("Only students can make purchases using their wallet.");
    }

    const text = await request.text();
    const json = superjson.parse(text);
    const { promoCodeId } = schema.parse(json);

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
          "courses.price as coursePrice",
          "courses.teacherId as courseTeacherId",
          "digitalProducts.title as digitalProductTitle",
          "digitalProducts.price as digitalProductPrice",
          "digitalProducts.teacherId as digitalProductTeacherId",
        ])
        .execute();

      if (cartItems.length === 0) {
        throw new Error("Your cart is empty.");
      }

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

      let discountAmount = 0;
      let finalAmount = totalAmount;
      let validatedPromoCodeId: number | null = null;
      let eligibleItemIds: Array<{ type: "test" | "course" | "digitalProduct"; id: number }> = [];

      // 4. Validate and apply promo code if provided
      if (promoCodeId) {
        const promoCode = await trx
          .selectFrom("promoCodes")
          .where("id", "=", promoCodeId)
          .where("isActive", "=", true)
          .selectAll()
          .executeTakeFirst();

        if (!promoCode) {
          throw new Error("Invalid or inactive promo code.");
        }

        const now = new Date();
        if (promoCode.validFrom && new Date(promoCode.validFrom) > now) {
          throw new Error("This promo code is not yet valid.");
        }
        if (promoCode.validUntil && new Date(promoCode.validUntil) < now) {
          throw new Error("This promo code has expired.");
        }

        if (promoCode.usageLimit !== null && promoCode.usageCount >= promoCode.usageLimit) {
          throw new Error("This promo code has reached its usage limit.");
        }

        if (promoCode.perUserLimit !== null) {
          const userUsageCount = await trx
            .selectFrom("promoCodeUsages")
            .where("promoCodeId", "=", promoCodeId)
            .where("userId", "=", user.id)
            .select(trx.fn.count<number>("id").as("count"))
            .executeTakeFirst();

          if (userUsageCount && userUsageCount.count >= promoCode.perUserLimit) {
            throw new Error("You have reached the usage limit for this promo code.");
          }
        }

        if (promoCode.minPurchaseAmount !== null && totalAmount < parseFloat(String(promoCode.minPurchaseAmount))) {
          throw new Error(`Minimum purchase amount of ₹${promoCode.minPurchaseAmount} is required for this promo code.`);
        }

        let hasApplicableItems = false;
        if (promoCode.appliesTo === "all") {
          hasApplicableItems = true;
        } else if (promoCode.appliesTo === "tests") {
          hasApplicableItems = cartItems.some((item) => item.mockTestId !== null);
        } else if (promoCode.appliesTo === "courses") {
          hasApplicableItems = cartItems.some((item) => item.courseId !== null);
        }

        if (!hasApplicableItems) {
          throw new Error("This promo code is not applicable to the items in your cart.");
        }

        for (const item of cartItems) {
          let isEligible = false;

          if (promoCode.appliesTo === "all") {
            isEligible = true;
          } else if (promoCode.appliesTo === "tests" && item.mockTestId) {
            isEligible = true;
          } else if (promoCode.appliesTo === "courses" && item.courseId) {
            isEligible = true;
          }

          if (isEligible && promoCode.targetItemIds && promoCode.targetItemIds.length > 0) {
            if (item.mockTestId) {
              isEligible = promoCode.targetItemIds.includes(item.mockTestId);
            } else if (item.courseId) {
              isEligible = promoCode.targetItemIds.includes(item.courseId);
            } else if (item.digitalProductId) {
              isEligible = promoCode.targetItemIds.includes(item.digitalProductId);
            } else {
              isEligible = false;
            }
          }

          const itemTeacherId = item.mockTestId
            ? item.testTeacherId
            : item.courseId
              ? item.courseTeacherId
              : item.digitalProductTeacherId;
          if (isEligible && !promoCodeCoversTeacher(promoCode.createdByTeacherId, itemTeacherId)) {
            isEligible = false;
          }

          if (isEligible) {
            if (item.mockTestId) eligibleItemIds.push({ type: "test", id: item.mockTestId });
            else if (item.courseId) eligibleItemIds.push({ type: "course", id: item.courseId });
            else if (item.digitalProductId) eligibleItemIds.push({ type: "digitalProduct", id: item.digitalProductId });
          }
        }

        if (eligibleItemIds.length === 0) {
          throw new Error("This promo code is not applicable to any items in your cart.");
        }

        const eligibleItemsTotal = cartItems.reduce((sum, item) => {
          const isEligible = eligibleItemIds.some((eligible) => {
            if (eligible.type === "test" && item.mockTestId === eligible.id) return true;
            if (eligible.type === "course" && item.courseId === eligible.id) return true;
            if (eligible.type === "digitalProduct" && item.digitalProductId === eligible.id) return true;
            return false;
          });

          if (!isEligible) return sum;

          if (item.mockTestId) return sum + parseFloat(String(item.testDiscountPrice ?? item.testPrice!));
          if (item.courseId) return sum + parseFloat(String(item.coursePrice!));
          if (item.digitalProductId) return sum + parseFloat(String(item.digitalProductPrice!));
          return sum;
        }, 0);

        if (promoCode.discountType === "percentage") {
          discountAmount = (eligibleItemsTotal * parseFloat(String(promoCode.discountValue))) / 100;
          if (promoCode.maxDiscountAmount !== null) {
            discountAmount = Math.min(discountAmount, parseFloat(String(promoCode.maxDiscountAmount)));
          }
        } else {
          discountAmount = parseFloat(String(promoCode.discountValue));
        }

        discountAmount = Math.min(discountAmount, eligibleItemsTotal);
        finalAmount = totalAmount - discountAmount;
        validatedPromoCodeId = promoCodeId;

        await trx
          .updateTable("promoCodes")
          .set({ usageCount: sql`usage_count + 1` })
          .where("id", "=", promoCodeId)
          .execute();
      }

      finalAmount = Math.max(0, finalAmount);

      // 5. Compute student's available balance
      const balanceInfo = await getStudentAvailableBalance(user.id, trx);
      if (balanceInfo.availableBalance < finalAmount) {
        throw new Error(`Insufficient wallet balance. You have ₹${balanceInfo.availableBalance.toFixed(2)} available but need ₹${finalAmount.toFixed(2)}.`);
      }

      // Calculate per-item discount amounts for eligible items
      const eligibleItemsTotal =
        validatedPromoCodeId && eligibleItemIds.length > 0
          ? cartItems
              .filter((item) => {
                return eligibleItemIds.some((eligible) => {
                  if (eligible.type === "test" && item.mockTestId === eligible.id) return true;
                  if (eligible.type === "course" && item.courseId === eligible.id) return true;
                  if (eligible.type === "digitalProduct" && item.digitalProductId === eligible.id) return true;
                  return false;
                });
              })
              .reduce((sum, item) => {
                if (item.mockTestId) return sum + parseFloat(String(item.testDiscountPrice ?? item.testPrice!));
                if (item.courseId) return sum + parseFloat(String(item.coursePrice!));
                if (item.digitalProductId) return sum + parseFloat(String(item.digitalProductPrice!));
                return sum;
              }, 0)
          : 0;

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
          totalAmount: finalAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          promoCodeId: validatedPromoCodeId,
          status: "completed",
          paymentMethod: "wallet",
          paymentTransactionId: null,
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

          let itemDiscount = 0;
          const isEligible = eligibleItemIds.some((eligible) => {
            if (eligible.type === "test" && item.mockTestId === eligible.id) return true;
            if (eligible.type === "course" && item.courseId === eligible.id) return true;
            if (eligible.type === "digitalProduct" && item.digitalProductId === eligible.id) return true;
            return false;
          });

          if (validatedPromoCodeId && isEligible && eligibleItemsTotal > 0) {
            itemDiscount = (itemPrice / eligibleItemsTotal) * discountAmount;
          }

          let platformFeePercentage = 30;
          if (item.mockTestId && item.testTeacherId) platformFeePercentage = await getOrFetchFee(item.testTeacherId);
          else if (item.courseId && item.courseTeacherId) platformFeePercentage = await getOrFetchFee(item.courseTeacherId);
          else if (item.digitalProductId && item.digitalProductTeacherId) platformFeePercentage = await getOrFetchFee(item.digitalProductTeacherId);

          return {
            orderId: newOrder.id,
            mockTestId: item.mockTestId || null,
            courseId: item.courseId || null,
            digitalProductId: item.digitalProductId || null,
            priceAtPurchase: itemPrice.toFixed(2),
            discountAmount: itemDiscount.toFixed(2),
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

      if (validatedPromoCodeId) {
        await trx
          .insertInto("promoCodeUsages")
          .values({
            promoCodeId: validatedPromoCodeId,
            userId: user.id,
            orderId: newOrder.id,
            discountAmount: discountAmount.toFixed(2),
          })
          .execute();
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