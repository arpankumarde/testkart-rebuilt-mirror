import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { PAYU_MODE } from "../../../helpers/_publicConfigs";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { sql } from "kysely";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";
import { ensureOrderCompletionSideEffects } from "../../../helpers/ensureOrderCompletionSideEffects";
import { promoCodeCoversTeacher } from "../../../helpers/promoCodeEligibility";

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

    // Validate promoCodeId if provided
    if (promoCodeIdParam && (isNaN(promoCodeId!) || promoCodeId! <= 0)) {
      const errorHtml = generateErrorHtml("Invalid promo code parameter.", "/cart");
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
      let eligibleItemIds: Array<{ type: 'test' | 'course' | 'digitalProduct'; id: number }> = [];

      // Validate and apply promo code if provided
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
            .where("promoCodeId", "=", promoCodeId)
            .where("userId", "=", user.id)
            .select(trx.fn.count<number>("id").as("count"))
            .executeTakeFirst();

          if (userUsageCount && userUsageCount.count >= promoCode.perUserLimit) {
            throw new Error("You have reached the usage limit for this promo code.");
          }
        }

        // Check minimum purchase amount
        if (promoCode.minPurchaseAmount !== null && totalAmount < parseFloat(String(promoCode.minPurchaseAmount))) {
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
            return sum + parseFloat(String(item.testDiscountPrice ?? item.testPrice!));
          } else if (item.courseId) {
            return sum + parseFloat(String(item.coursePrice!));
          } else if (item.digitalProductId) {
            return sum + parseFloat(String(item.digitalProductPrice!));
          }
          return sum;
        }, 0);

        // Calculate discount
        if (promoCode.discountType === "percentage") {
          discountAmount = (eligibleItemsTotal * parseFloat(String(promoCode.discountValue))) / 100;
          if (promoCode.maxDiscountAmount !== null) {
            discountAmount = Math.min(discountAmount, parseFloat(String(promoCode.maxDiscountAmount)));
          }
        } else {
          // fixed discount
          discountAmount = parseFloat(String(promoCode.discountValue));
        }

        // Ensure discount doesn't exceed eligible items total
        discountAmount = Math.min(discountAmount, eligibleItemsTotal);
        finalAmount = totalAmount - discountAmount;

        validatedPromoCodeId = promoCodeId;

        // Increment promo code usage count atomically
        await trx
          .updateTable("promoCodes")
          .set({ usageCount: sql`usage_count + 1` })
          .where("id", "=", promoCodeId)
          .execute();

        console.log(`Promo code ${promoCode.code} applied. Discount: ₹${discountAmount.toFixed(2)}`);
      }

      // Clamp finalAmount to 0 to prevent negative totals
      finalAmount = Math.max(0, finalAmount);

      // Calculate per-item discount amounts for eligible items (needed for both free and paid paths)
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
                return sum + parseFloat(String(item.testDiscountPrice ?? item.testPrice!));
              } else if (item.courseId) {
                return sum + parseFloat(String(item.coursePrice!));
              } else if (item.digitalProductId) {
                return sum + parseFloat(String(item.digitalProductPrice!));
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

      // -----------------------------------------------------------------------
      // ZERO-TOTAL PATH: Handle free orders without involving PayU
      // -----------------------------------------------------------------------
      if (finalAmount <= 0) {
        console.log(`[redirect_GET] Zero-total order for user ${user.id}. Processing as free order.`);

        const newOrder = await trx
          .insertInto("orders")
          .values({
            userId: user.id,
            totalAmount: "0.00",
            discountAmount: discountAmount.toFixed(2),
            promoCodeId: validatedPromoCodeId,
            status: "completed",
            paymentMethod: "free",
            paymentTransactionId: null,
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

          let itemDiscount = 0;
          const isEligible = eligibleItemIds.some(eligible => {
            if (eligible.type === 'test' && item.mockTestId === eligible.id) return true;
            if (eligible.type === 'course' && item.courseId === eligible.id) return true;
            if (eligible.type === 'digitalProduct' && item.digitalProductId === eligible.id) return true;
            return false;
          });

          if (validatedPromoCodeId && isEligible && eligibleItemsTotal > 0) {
            itemDiscount = (itemPrice / eligibleItemsTotal) * discountAmount;
          }

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
            mockTestId: item.mockTestId || null,
            courseId: item.courseId || null,
            digitalProductId: item.digitalProductId || null,
            priceAtPurchase: itemPrice.toFixed(2),
            discountAmount: itemDiscount.toFixed(2),
            platformFeePercentage: platformFeePercentage.toFixed(2),
          };
        }));

        await trx.insertInto("orderItems").values(orderItems).execute();

        // Record promo code usage if applicable
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
          totalAmount: finalAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          promoCodeId: validatedPromoCodeId,
          status: "pending",
          paymentMethod: "payu",
          paymentTransactionId: txnid,
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
          mockTestId: item.mockTestId || null,
          courseId: item.courseId || null,
          digitalProductId: item.digitalProductId || null,
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