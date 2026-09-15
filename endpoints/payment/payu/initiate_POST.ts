import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./initiate_POST.schema";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { PAYU_MODE } from "../../../helpers/_publicConfigs";
import { sql } from "kysely";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";
import { promoCodeCoversTeacher } from "../../../helpers/promoCodeEligibility";

export async function handle(request: Request) {
  try {
    // Always use production domain for PayU callback URLs
    const baseUrl = "https://testkart.in";
    const { user } = await getServerUserSession(request);
    const body = superjson.parse(await request.text());
    const input = schema.parse(body);

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

      let discountAmount = 0;
      let finalAmount = totalAmount;
      let validatedPromoCodeId: number | null = null;
      let eligibleItemIds: Array<{ type: 'test' | 'course' | 'digitalProduct'; id: number }> = [];

      // Validate and apply promo code if provided
      if (input.promoCodeId) {
        const promoCode = await trx
          .selectFrom("promoCodes")
          .where("id", "=", input.promoCodeId)
          .where("isActive", "=", true)
          .selectAll()
          .executeTakeFirst();

        if (!promoCode) {
          throw new Error("Invalid or inactive promo code.");
        }

        // Check if promo code is valid (time-based)
        const now = new Date();
        if (promoCode.validFrom && new Date(promoCode.validFrom) > now) {
          throw new Error("This promo code is not yet valid.");
        }
        if (promoCode.validUntil && new Date(promoCode.validUntil) < now) {
          throw new Error("This promo code has expired.");
        }

        // Check usage limits
        if (promoCode.usageLimit !== null && promoCode.usageCount >= promoCode.usageLimit) {
          throw new Error("This promo code has reached its usage limit.");
        }

        // Check per-user limit
        if (promoCode.perUserLimit !== null) {
          const userUsageCount = await trx
            .selectFrom("promoCodeUsages")
            .where("promoCodeId", "=", input.promoCodeId)
            .where("userId", "=", user.id)
            .select(trx.fn.count<number>("id").as("count"))
            .executeTakeFirst();

          if (userUsageCount && userUsageCount.count >= promoCode.perUserLimit) {
            throw new Error("You have reached the usage limit for this promo code.");
          }
        }

        // Check minimum purchase amount
        if (promoCode.minPurchaseAmount !== null && totalAmount < parseFloat(promoCode.minPurchaseAmount)) {
          throw new Error(`Minimum purchase amount of ₹${promoCode.minPurchaseAmount} is required for this promo code.`);
        }

        // Check if promo code applies to cart items
        let hasApplicableItems = false;

        if (promoCode.appliesTo === "all") {
          hasApplicableItems = true;
        } else if (promoCode.appliesTo === "tests") {
          hasApplicableItems = cartItems.some(item => item.mockTestId !== null);
        } else if (promoCode.appliesTo === "courses") {
          hasApplicableItems = cartItems.some(item => item.courseId !== null);
        } else if (promoCode.appliesTo === "live_tests") {
          // Live tests are not in the cart, so this would be false
          hasApplicableItems = false;
        }

        if (!hasApplicableItems) {
          throw new Error("This promo code is not applicable to the items in your cart.");
        }

        // Build eligible items list based on appliesTo and targetItemIds
        for (const item of cartItems) {
          let isEligible = false;

          if (promoCode.appliesTo === "all") {
            isEligible = true;
          } else if (promoCode.appliesTo === "tests" && item.mockTestId) {
            isEligible = true;
          } else if (promoCode.appliesTo === "courses" && item.courseId) {
            isEligible = true;
          }

          // Further filter by targetItemIds if specified
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
            if (item.mockTestId) {
              eligibleItemIds.push({ type: 'test', id: item.mockTestId });
            } else if (item.courseId) {
              eligibleItemIds.push({ type: 'course', id: item.courseId });
            } else if (item.digitalProductId) {
              eligibleItemIds.push({ type: 'digitalProduct', id: item.digitalProductId });
            }
          }
        }

        if (eligibleItemIds.length === 0) {
          throw new Error("This promo code is not applicable to any items in your cart.");
        }

        // Calculate eligible items total
        const eligibleItemsTotal = cartItems.reduce((sum, item) => {
          const isEligible = eligibleItemIds.some(eligible => {
            if (eligible.type === 'test' && item.mockTestId === eligible.id) return true;
            if (eligible.type === 'course' && item.courseId === eligible.id) return true;
            if (eligible.type === 'digitalProduct' && item.digitalProductId === eligible.id) return true;
            return false;
          });

          if (!isEligible) return sum;

          if (item.mockTestId) {
            return sum + parseFloat(item.testDiscountPrice || item.testPrice!);
          } else if (item.courseId) {
            return sum + parseFloat(item.coursePrice!);
          } else if (item.digitalProductId) {
            return sum + parseFloat(item.digitalProductPrice!);
          }
          return sum;
        }, 0);

        // Calculate discount
        if (promoCode.discountType === "percentage") {
          discountAmount = (eligibleItemsTotal * parseFloat(promoCode.discountValue)) / 100;
          if (promoCode.maxDiscountAmount !== null) {
            discountAmount = Math.min(discountAmount, parseFloat(promoCode.maxDiscountAmount));
          }
        } else {
          // fixed discount
          discountAmount = parseFloat(promoCode.discountValue);
        }

        // Ensure discount doesn't exceed eligible items total
        discountAmount = Math.min(discountAmount, eligibleItemsTotal);
        finalAmount = totalAmount - discountAmount;

        validatedPromoCodeId = input.promoCodeId;

        // Increment promo code usage count atomically
        await trx
          .updateTable("promoCodes")
          .set({ usageCount: sql`usage_count + 1` })
          .where("id", "=", input.promoCodeId)
          .execute();

        console.log(`Promo code ${promoCode.code} applied. Discount: ₹${discountAmount.toFixed(2)}`);
      }

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
          totalAmount: finalAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          promoCodeId: validatedPromoCodeId,
          status: "pending",
          paymentMethod: "payu",
          paymentTransactionId: txnid,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      // Calculate per-item discount amounts for eligible items
      const eligibleItemsTotal = validatedPromoCodeId && eligibleItemIds.length > 0
        ? cartItems
            .filter(item => {
              return eligibleItemIds.some(eligible => {
                if (eligible.type === 'test' && item.mockTestId === eligible.id) return true;
                if (eligible.type === 'course' && item.courseId === eligible.id) return true;
                if (eligible.type === 'digitalProduct' && item.digitalProductId === eligible.id) return true;
                return false;
              });
            })
            .reduce((sum, item) => {
              if (item.mockTestId) {
                return sum + parseFloat(item.testDiscountPrice || item.testPrice!);
              } else if (item.courseId) {
                return sum + parseFloat(item.coursePrice!);
              } else if (item.digitalProductId) {
                return sum + parseFloat(item.digitalProductPrice!);
              }
              return sum;
            }, 0)
        : 0;

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

        let itemDiscount = 0;

        // Check if this item is eligible for discount
        const isEligible = eligibleItemIds.some(eligible => {
          if (eligible.type === 'test' && item.mockTestId === eligible.id) return true;
          if (eligible.type === 'course' && item.courseId === eligible.id) return true;
          if (eligible.type === 'digitalProduct' && item.digitalProductId === eligible.id) return true;
          return false;
        });

        // Calculate proportional discount for eligible items only
        if (validatedPromoCodeId && isEligible && eligibleItemsTotal > 0) {
          itemDiscount = (itemPrice / eligibleItemsTotal) * discountAmount;
        }

        // Determine teacherId for this item and look up platform fee
        let platformFeePercentage = 30;
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
          discountAmount: itemDiscount.toFixed(2),
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

      // Record promo code usage
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