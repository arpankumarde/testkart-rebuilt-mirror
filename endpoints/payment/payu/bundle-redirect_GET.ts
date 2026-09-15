import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { PAYU_MODE } from "../../../helpers/_publicConfigs";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { completeBundleEnrollment } from "../../../helpers/completeBundleEnrollment";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";
import { Transaction, Selectable } from "kysely";
import { DB, PromoCodes } from "../../../helpers/schema";

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
        <a href="${backUrl}">Go Back to Bundle</a>
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

interface PromoValidationResult {
  discountAmount: number;
  promoCode: Selectable<PromoCodes>;
}

async function validateAndCalculatePromo(
  trx: Transaction<DB>,
  promoCodeId: number,
  bundle: { id: number; teacherId: number; price: string | number },
  studentId: number,
  amount: number
): Promise<PromoValidationResult> {
  const promoCode = await trx
    .selectFrom("promoCodes")
    .selectAll()
    .where("id", "=", promoCodeId)
    .where("isActive", "=", true)
    .executeTakeFirst();

  if (!promoCode) {
    throw new Error("Invalid or inactive promo code.");
  }

  const now = new Date();
  if (promoCode.validFrom && new Date(promoCode.validFrom) > now) {
    throw new Error("Promo code is not yet valid.");
  }
  if (promoCode.validUntil && new Date(promoCode.validUntil) < now) {
    throw new Error("Promo code has expired.");
  }

  if (promoCode.usageLimit !== null && promoCode.usageCount >= promoCode.usageLimit) {
    throw new Error("Promo code usage limit has been reached.");
  }

  if (promoCode.perUserLimit !== null) {
    const userUsageCount = await trx
      .selectFrom("promoCodeUsages")
      .where("promoCodeId", "=", promoCodeId)
      .where("userId", "=", studentId)
      .execute();
    if (userUsageCount.length >= promoCode.perUserLimit) {
      throw new Error("You have already used this promo code the maximum number of times.");
    }
  }

  if (promoCode.createdByTeacherId !== null && promoCode.createdByTeacherId !== bundle.teacherId) {
    throw new Error("This promo code is not valid for this bundle.");
  }

  if (promoCode.appliesTo !== "all" && promoCode.appliesTo !== "bundles") {
    throw new Error("This promo code is not applicable to bundles.");
  }

  if (promoCode.targetItemIds && promoCode.targetItemIds.length > 0) {
    if (!promoCode.targetItemIds.includes(bundle.id)) {
      throw new Error("This promo code is not valid for this specific bundle.");
    }
  }

  let calculatedDiscount = 0;
  if (promoCode.discountType === "fixed") {
    calculatedDiscount = parseFloat(promoCode.discountValue);
  } else if (promoCode.discountType === "percentage") {
    calculatedDiscount = (amount * parseFloat(promoCode.discountValue)) / 100;
    if (promoCode.maxDiscountAmount) {
      calculatedDiscount = Math.min(calculatedDiscount, parseFloat(promoCode.maxDiscountAmount));
    }
  }

  calculatedDiscount = Math.min(calculatedDiscount, amount);

  return {
    discountAmount: calculatedDiscount,
    promoCode,
  };
}

async function recordPromoUsage(
  trx: Transaction<DB>,
  promoCodeId: number,
  studentId: number,
  orderId: number,
  discountAmount: number
) {
  await trx
    .insertInto("promoCodeUsages")
    .values({
      promoCodeId,
      userId: studentId,
      orderId,
      discountAmount: discountAmount.toFixed(2),
    })
    .execute();

  await trx
    .updateTable("promoCodes")
    .set((eb) => ({ usageCount: eb("usageCount", "+", 1) }))
    .where("id", "=", promoCodeId)
    .execute();
}

export async function handle(request: Request) {
  const baseUrl = "https://testkart.in";
  
  try {
    const { user } = await getServerUserSession(request);

    if (user.role === "teacher") {
      const errorHtml = generateErrorHtml("Teachers cannot purchase bundles. This is for students only.", "/bundles");
      return new Response(errorHtml, { status: 403, headers: { "Content-Type": "text/html" } });
    }

    const url = new URL(request.url);
    const bundleIdParam = url.searchParams.get("bundleId");
    const bundleId = bundleIdParam ? parseInt(bundleIdParam, 10) : null;
    const promoCodeIdParam = url.searchParams.get("promoCodeId");
    const promoCodeId = promoCodeIdParam ? parseInt(promoCodeIdParam, 10) : null;

    if (!bundleId || isNaN(bundleId) || bundleId <= 0) {
      const errorHtml = generateErrorHtml("Invalid bundle ID parameter.", "/bundles");
      return new Response(errorHtml, { status: 400, headers: { "Content-Type": "text/html" } });
    }

    if (promoCodeId !== null && (isNaN(promoCodeId) || promoCodeId <= 0)) {
      const errorHtml = generateErrorHtml("Invalid promo code ID parameter.", "/bundles");
      return new Response(errorHtml, { status: 400, headers: { "Content-Type": "text/html" } });
    }

    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      console.error("PayU merchant key or salt is not configured.");
      const errorHtml = generateErrorHtml("Payment gateway is not configured. Please contact support.", `/bundles`);
      return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html" } });
    }

    type PaidOrderResult = { kind: 'paid'; formData: { [key: string]: string } };
    type FreeOrderResult = { kind: 'free'; orderId: number };
    type TransactionResult = PaidOrderResult | FreeOrderResult;

    const result = await db.transaction().execute(async (trx): Promise<TransactionResult> => {
      const bundle = await trx
        .selectFrom("courseBundles")
        .where("id", "=", bundleId)
        .selectAll()
        .executeTakeFirst();

      if (!bundle || !bundle.isPublished) {
        throw new Error("Bundle not found or not available for purchase.");
      }

      const existingEnrollment = await trx
        .selectFrom("bundleEnrollments")
        .select("id")
        .where("studentId", "=", user.id)
        .where("bundleId", "=", bundle.id)
        .executeTakeFirst();

      if (existingEnrollment) {
        throw new Error("You are already enrolled in this bundle.");
      }

      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("userId", "=", user.id)
        .where("status", "=", "pending")
        .execute();

      const platformFeePercentage = await getTeacherPlatformFee(bundle.teacherId, trx);

      const originalAmount = Number(bundle.price);
      let discountAmount = 0;
      let promoCode: Selectable<PromoCodes> | null = null;

      if (promoCodeId) {
        const promoResult = await validateAndCalculatePromo(trx, promoCodeId, bundle, user.id, originalAmount);
        discountAmount = promoResult.discountAmount;
        promoCode = promoResult.promoCode;
      }

      const finalAmount = Math.max(0, originalAmount - discountAmount);

      if (finalAmount <= 0) {
        console.log(`[bundle-redirect_GET] Zero-total bundle order for user ${user.id} after discount. Processing as free order.`);

        const newOrder = await trx
          .insertInto("orders")
          .values({
            userId: user.id,
            bundleId: bundle.id,
            totalAmount: "0.00",
            status: "completed",
            paymentMethod: "free",
            paymentTransactionId: null,
            discountAmount: discountAmount.toFixed(2),
            promoCodeId: promoCode ? promoCode.id : null,
            platformFeePercentage: platformFeePercentage.toFixed(2),
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        await completeBundleEnrollment(trx, bundle.id, user.id, newOrder.id);

        if (promoCode) {
          await recordPromoUsage(trx, promoCode.id, user.id, newOrder.id, discountAmount);
        }

        console.log(`[bundle-redirect_GET] Free bundle order ${newOrder.id} completed for user ${user.id}.`);
        return { kind: 'free', orderId: newOrder.id };
      }

      const txnid = `testkart-${nanoid(12)}`;

      const newOrder = await trx
        .insertInto("orders")
        .values({
          userId: user.id,
          bundleId: bundle.id,
          totalAmount: finalAmount.toFixed(2),
          status: "pending",
          paymentMethod: "payu",
          paymentTransactionId: txnid,
          discountAmount: discountAmount.toFixed(2),
          promoCodeId: promoCode ? promoCode.id : null,
          platformFeePercentage: platformFeePercentage.toFixed(2),
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      if (promoCode) {
        await recordPromoUsage(trx, promoCode.id, user.id, newOrder.id, discountAmount);
      }

      const email = user.email ?? `${user.mobileNumber}@mail.testkart.in`;
      const firstname = (user.displayName || "Student").replace(/\|/g, " ");
      const sanitizedProductInfo = bundle.title.substring(0, 100).replace(/\|/g, " ");

      const amountStr = finalAmount.toFixed(2);
      const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amountStr}|${sanitizedProductInfo}|${firstname}|${email}|||||||||||${PAYU_MERCHANT_SALT}`;
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
          amount: amountStr,
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
      const html = generateFreeOrderRedirectHtml(
        `${baseUrl}/student/dashboard?order_id=${result.orderId}&free=true`
      );
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    const html = generateRedirectHtml(result.formData);
    return new Response(html, { headers: { "Content-Type": "text/html" } });

  } catch (error) {
    console.error("Failed to initiate bundle payment redirect:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    
    const backUrl = `/bundles`;
    
    const errorHtml = generateErrorHtml(`Failed to initiate payment: ${errorMessage}`, backUrl);
    return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html" } });
  }
}