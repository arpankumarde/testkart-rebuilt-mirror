import { db } from "../../../helpers/db";
import { schema } from "./callback_POST.schema";
import { createHash } from "crypto";
import crypto from "crypto";
import { sql } from "kysely";
import { SignJWT } from "jose";
import { ensureOrderCompletionSideEffects } from "../../../helpers/ensureOrderCompletionSideEffects";
import { Session, setServerSession, SessionExpirationSeconds } from "../../../helpers/getSetServerSession";
import { sendEmail } from "../../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import { serializeForInlineScript } from "../../../helpers/serializeForInlineScript";
import { extractPayUFailure, isPayUCancellation } from "../../../helpers/extractPayUFailure";
import { paymentFailureReason } from "../../../helpers/paymentFailureReason";

function isDeepLink(url: string): boolean {
  return url.includes("://") && !url.startsWith("http://") && !url.startsWith("https://");
}

async function createMobileSession(userId: number, now: Date): Promise<string> {
  const sessionId = crypto.randomUUID();
  const sessionExpiresAt = new Date(now.getTime() + SessionExpirationSeconds * 1000);
  await db
    .insertInto("sessions")
    .values({
      id: sessionId,
      userId,
      expiresAt: sessionExpiresAt,
      createdAt: now,
      lastAccessed: now,
    })
    .execute();
  return sessionId;
}

async function generateMobileJwt(sessionId: string, now: Date): Promise<string> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET not configured");
  const encoder = new TextEncoder();
  return new SignJWT({
    id: sessionId,
    createdAt: now.getTime(),
    lastAccessed: now.getTime(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(encoder.encode(jwtSecret));
}

/**
 * Helper to fetch the most recent non-expired session for a given user.
 * Returns null if no valid session exists.
 */
async function fetchUserSession(userId: number): Promise<Session | null> {
  try {
    const sessionRecord = await db
      .selectFrom("sessions")
      .selectAll()
      .where("userId", "=", userId)
      .where("expiresAt", ">", new Date())
      .orderBy("lastAccessed", "desc")
      .executeTakeFirst();

    if (sessionRecord && sessionRecord.createdAt && sessionRecord.lastAccessed) {
      return {
        id: sessionRecord.id,
        createdAt: new Date(sessionRecord.createdAt).getTime(),
        lastAccessed: new Date(sessionRecord.lastAccessed).getTime(),
        passwordChangeRequired: false,
        impersonatorAdminId: sessionRecord.impersonatorAdminId ?? undefined,
      };
    }
    return null;
  } catch (error) {
    console.error("[PayU Callback] Failed to fetch user session:", error);
    return null;
  }
}

export async function handle(request: Request) {
  const baseUrl = "https://testkart.in";
  const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
  const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

  // Fast-fail on configuration errors
  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    console.error("[PayU Callback] PayU merchant key or salt not configured");
    return createHtmlResponse({
      status: 'failed',
      txnid: '',
      redirectUrl: `${baseUrl}/cart?error=payment_config`,
    });
  }

  try {
    const formData = await request.formData();
    const data = Object.fromEntries(formData.entries());
    const validatedData = schema.parse(data);

    const {
      status,
      unmappedstatus,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      hash: receivedHash,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      additionalCharges,
    } = validatedData;

    // Build hash string according to PayU documentation
    const hashString = additionalCharges && additionalCharges.trim() !== ""
      ? `${additionalCharges}|${PAYU_MERCHANT_SALT}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${PAYU_MERCHANT_KEY}`
      : `${PAYU_MERCHANT_SALT}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${PAYU_MERCHANT_KEY}`;
    
    const calculatedHash = createHash("sha512").update(hashString).digest("hex");

    // Fast-fail on invalid hash
    if (calculatedHash.toLowerCase() !== receivedHash.toLowerCase()) {
      console.error(`[PayU Callback] Hash mismatch for txnid ${txnid}`);
      return createHtmlResponse({
        status: 'failed',
        txnid: '', // hash failed, so txnid is unverified input
        redirectUrl: `${baseUrl}/cart?error=invalid_hash`,
      });
    }

    // PayU's reason fields are not covered by the response hash; only the hashed status decides the outcome.
    const failureColumns = extractPayUFailure(validatedData);

    // Handle cancellation (Cancel or Back pressed on the PayU page)
    if (isPayUCancellation({ status, unmappedstatus })) {
      const existingOrder = await db
        .updateTable("orders")
        .set({ status: "cancelled", ...failureColumns })
        .where("paymentTransactionId", "=", txnid)
        .where("status", "=", "pending")
        .returning(["id", "userId"])
        .executeTakeFirst();
      
      if (!existingOrder) {
        return createHtmlResponse({
          status: 'failed',
          txnid,
          redirectUrl: `${baseUrl}/cart?error=order_not_found`,
        });
      }

      // Fetch session to preserve user login
      const userSession = await fetchUserSession(existingOrder.userId);

      // Deep link flow: redirect to mobile app with cancelled status
      if (udf1 && isDeepLink(udf1)) {
        const deepLinkUrl = new URL(udf1);
        deepLinkUrl.searchParams.set("status", "cancelled");
        deepLinkUrl.searchParams.set("order_id", String(existingOrder.id));
        const response = new Response("Redirecting...", {
          status: 302,
          headers: { Location: deepLinkUrl.toString() },
        });
        if (userSession) {
          await setServerSession(response, userSession);
        }
        return response;
      }

      return createHtmlResponse({
        status: 'cancelled',
        txnid,
        redirectUrl: `${baseUrl}/cart?cancelled=true&order_id=${existingOrder.id}`,
        session: userSession ?? undefined,
      });
    }

    // Determine new status
    const newStatus: "completed" | "failed" = status === "success" ? "completed" : "failed";

    // Single transaction for all database operations
    const result = await db.transaction().execute(async (trx) => {
      // Atomic order claim - only update if status is still 'pending'
      const claimedOrder = await trx
        .updateTable("orders")
        .set(newStatus === "failed" ? { status: newStatus, ...failureColumns } : { status: newStatus })
        .where("paymentTransactionId", "=", txnid)
        .where("status", "=", "pending")
        .returningAll()
        .executeTakeFirst();

      if (!claimedOrder) {
        return null;
      }

      // Fetch order items once
      const orderItems = await trx
        .selectFrom("orderItems")
        .select(["mockTestId", "courseId", "digitalProductId", "orderId"])
        .where("orderId", "=", claimedOrder.id)
        .execute();

      const mockTestIds = orderItems
        .filter(item => item.mockTestId !== null)
        .map(item => item.mockTestId!);
      
      const courseItems = orderItems
        .filter(item => item.courseId !== null)
        .map(item => item.courseId!);
      
      const digitalProductItems = orderItems
        .filter(item => item.digitalProductId !== null)
        .map(item => item.digitalProductId!);

      // Check for live test early (needed for enrollment even if payment fails to be idempotent)
      let liveTestId: number | null = null;
      if (mockTestIds.length > 0) {
        const liveTest = await trx
          .selectFrom("liveTests")
          .select("id")
          .where("mockTestId", "in", mockTestIds)
          .executeTakeFirst();
        liveTestId = liveTest?.id ?? null;
      }

      // For successful payments, run cleanup and enrollments
      if (status === "success") {
        await Promise.all([
          trx
            .deleteFrom("cartItems")
            .where("userId", "=", claimedOrder.userId)
            .execute(),
          mockTestIds.length > 0
            ? trx
                .updateTable("mockTests")
                .set({ studentsEnrolled: sql`students_enrolled + 1` })
                .where("id", "in", mockTestIds)
                .execute()
            : Promise.resolve(),
          courseItems.length > 0
            ? trx
                .insertInto("courseEnrollments")
                .values(
                  courseItems.map(courseId => ({
                    studentId: claimedOrder.userId,
                    courseId: courseId,
                    enrolledAt: new Date(),
                  }))
                )
                .onConflict((oc) =>
                  oc.columns(["studentId", "courseId"]).doNothing()
                )
                .execute()
            : Promise.resolve(),
          digitalProductItems.length > 0
            ? trx
                .insertInto("digitalProductPurchases")
                .values(
                  digitalProductItems.map(productId => ({
                    studentId: claimedOrder.userId,
                    productId: productId,
                    orderId: claimedOrder.id,
                    purchasedAt: new Date(),
                  }))
                )
                .onConflict((oc) =>
                  oc.columns(["studentId", "productId"]).doNothing()
                )
                .execute()
            : Promise.resolve(),
          digitalProductItems.length > 0
            ? trx
                .updateTable("digitalProducts")
                .set((eb) => ({
                  totalPurchases: eb("totalPurchases", "+", 1),
                }))
                .where("id", "in", digitalProductItems)
                .execute()
            : Promise.resolve(),
          mockTestIds.length > 0
            ? trx
                .insertInto("mockTestEnrollments")
                .values(
                  mockTestIds.map(mockTestId => ({
                    studentId: claimedOrder.userId,
                    mockTestId,
                    orderId: claimedOrder.id,
                    enrolledAt: new Date(),
                  }))
                )
                .onConflict((oc) =>
                  oc.columns(["mockTestId", "studentId"]).doNothing()
                )
                .execute()
            : Promise.resolve(),
        ]);

        // Bundle enrollment handling
        if (claimedOrder.bundleId !== null) {
          console.log(`[PayU Callback] Processing bundle enrollment for bundle ${claimedOrder.bundleId}, user ${claimedOrder.userId}`);

          await trx
            .insertInto("bundleEnrollments")
            .values({
              studentId: claimedOrder.userId,
              bundleId: claimedOrder.bundleId,
              orderId: claimedOrder.id,
              enrolledAt: new Date(),
            })
            .onConflict((oc) =>
              oc.columns(["studentId", "bundleId"]).doNothing()
            )
            .execute();

          // Fetch bundle items and create individual enrollments
          const bundleItems = await trx
            .selectFrom("courseBundleItems")
            .select(["itemType", "mockTestId", "courseId", "digitalProductId"])
            .where("bundleId", "=", claimedOrder.bundleId)
            .execute();

          const bundleMockTestIds = bundleItems
            .filter(item => item.itemType === "test" && item.mockTestId !== null)
            .map(item => item.mockTestId!);
          const bundleCourseIds = bundleItems
            .filter(item => item.itemType === "course" && item.courseId !== null)
            .map(item => item.courseId!);
          const bundleDigitalProductIds = bundleItems
            .filter(item => item.itemType === "digital_product" && item.digitalProductId !== null)
            .map(item => item.digitalProductId!);

          await Promise.all([
            bundleMockTestIds.length > 0
              ? trx
                  .insertInto("mockTestEnrollments")
                  .values(
                    bundleMockTestIds.map(mockTestId => ({
                      studentId: claimedOrder.userId,
                      mockTestId,
                      orderId: claimedOrder.id,
                      enrolledAt: new Date(),
                    }))
                  )
                  .onConflict((oc) =>
                    oc.columns(["mockTestId", "studentId"]).doNothing()
                  )
                  .execute()
              : Promise.resolve(),
            bundleMockTestIds.length > 0
              ? trx
                  .updateTable("mockTests")
                  .set({ studentsEnrolled: sql`students_enrolled + 1` })
                  .where("id", "in", bundleMockTestIds)
                  .execute()
              : Promise.resolve(),
            bundleCourseIds.length > 0
              ? trx
                  .insertInto("courseEnrollments")
                  .values(
                    bundleCourseIds.map(courseId => ({
                      studentId: claimedOrder.userId,
                      courseId,
                      enrolledAt: new Date(),
                    }))
                  )
                  .onConflict((oc) =>
                    oc.columns(["studentId", "courseId"]).doNothing()
                  )
                  .execute()
              : Promise.resolve(),
            bundleDigitalProductIds.length > 0
              ? trx
                  .insertInto("digitalProductPurchases")
                  .values(
                    bundleDigitalProductIds.map(productId => ({
                      studentId: claimedOrder.userId,
                      productId,
                      orderId: claimedOrder.id,
                      purchasedAt: new Date(),
                    }))
                  )
                  .onConflict((oc) =>
                    oc.columns(["studentId", "productId"]).doNothing()
                  )
                  .execute()
              : Promise.resolve(),
            bundleDigitalProductIds.length > 0
              ? trx
                  .updateTable("digitalProducts")
                  .set((eb) => ({
                    totalPurchases: eb("totalPurchases", "+", 1),
                  }))
                  .where("id", "in", bundleDigitalProductIds)
                  .execute()
              : Promise.resolve(),
          ]);

          console.log(`[PayU Callback] Bundle enrollment completed for bundle ${claimedOrder.bundleId}, user ${claimedOrder.userId} (${bundleMockTestIds.length} tests, ${bundleCourseIds.length} courses, ${bundleDigitalProductIds.length} digital products)`);
        }

        // Server-side live test enrollment (idempotent)
        if (liveTestId !== null) {
          const existingEnrollment = await trx
            .selectFrom("liveTestEnrollments")
            .select("id")
            .where("studentId", "=", claimedOrder.userId)
            .where("liveTestId", "=", liveTestId)
            .executeTakeFirst();

          if (!existingEnrollment) {
            console.log(`[PayU Callback] Creating live test enrollment for user ${claimedOrder.userId} in live test ${liveTestId}`);
            await trx
              .insertInto("liveTestEnrollments")
              .values({
                studentId: claimedOrder.userId,
                liveTestId: liveTestId,
                paymentOrderId: claimedOrder.id,
              })
              .execute();

            await trx
              .updateTable("liveTests")
              .set({ enrolledCount: sql`enrolled_count + 1` })
              .where("id", "=", liveTestId)
              .execute();

            console.log(`[PayU Callback] Live test enrollment created for user ${claimedOrder.userId} in live test ${liveTestId}`);
          } else {
            console.log(`[PayU Callback] Live test enrollment already exists for user ${claimedOrder.userId} in live test ${liveTestId}`);
          }
        }
      }

      // Fetch student details for potential failure email (needed outside transaction)
      const studentForEmail = await trx
        .selectFrom("users")
        .select(["email", "displayName"])
        .where("id", "=", claimedOrder.userId)
        .executeTakeFirst();

      return { claimedOrder, liveTestId, studentForEmail: studentForEmail ?? null };
    });

    // Handle race condition - order already processed
    if (!result) {
      const existingOrder = await db
        .selectFrom("orders")
        .select(["id", "status", "userId"])
        .where("paymentTransactionId", "=", txnid)
        .executeTakeFirst();

      if (existingOrder) {
        // If order is completed, ensure all side effects exist
        if (existingOrder.status === 'completed') {
          console.log(`[PayU Callback] Order ${existingOrder.id} already completed, ensuring side effects exist`);
          await ensureOrderCompletionSideEffects(existingOrder.id);
        }
        
        // Fetch session to preserve user login
        const userSession = await fetchUserSession(existingOrder.userId);
        
        return createHtmlResponse({
          status: existingOrder.status === 'completed' ? 'success' : 'failed',
          txnid,
          redirectUrl: `${baseUrl}/order/${existingOrder.id}`,
          session: userSession ?? undefined,
        });
      }

      return createHtmlResponse({
        status: 'failed',
        txnid,
        redirectUrl: `${baseUrl}/cart?error=order_not_found`,
      });
    }

    const { claimedOrder, liveTestId, studentForEmail } = result;

    if (status === "success") {
      // Run side effects (emails, etc.) for successful payment
      await ensureOrderCompletionSideEffects(claimedOrder.id).catch((error) => {
        console.error(`[PayU Callback] Failed to run side effects for order ${claimedOrder.id}:`, error);
      });
    }

    // Fetch user session for cookie preservation using helper
    const userSession = await fetchUserSession(claimedOrder.userId);

    // Handle redirects based on result
    if (status === "success") {
      // Deep link flow: create a session, generate JWT, and redirect to mobile app
      if (udf1 && isDeepLink(udf1)) {
        const now = new Date();
        const sessionId = await createMobileSession(claimedOrder.userId, now);
        const jwtToken = await generateMobileJwt(sessionId, now);
        const deepLinkUrl = new URL(udf1);
        deepLinkUrl.searchParams.set("status", "success");
        deepLinkUrl.searchParams.set("order_id", String(claimedOrder.id));
        deepLinkUrl.searchParams.set("txnid", txnid);
        deepLinkUrl.searchParams.set("token", jwtToken);
        const response = new Response("Redirecting...", {
          status: 302,
          headers: { Location: deepLinkUrl.toString() },
        });
        if (userSession) {
          await setServerSession(response, userSession);
        }
        console.log(`[PayU Callback] Deep link success redirect for order ${claimedOrder.id} to ${udf1}`);
        return response;
      }

      // Priority 1: Live tests - enrollment is now done server-side, redirect with params for UI feedback
      if (liveTestId) {
        return createHtmlResponse({
          status: 'success',
          txnid,
          redirectUrl: `${baseUrl}/mock-test/live/${liveTestId}?status=success&order_id=${claimedOrder.id}&txnid=${txnid}`,
          session: userSession ?? undefined,
        });
      }

      // Priority 2: Default to dashboard
      return createHtmlResponse({
        status: 'success',
        txnid,
        redirectUrl: `${baseUrl}/student/dashboard?order_id=${claimedOrder.id}&txnid=${txnid}`,
        session: userSession ?? undefined,
      });
    } else {
      const failureReason = paymentFailureReason.describe(failureColumns)?.reason;

      // Payment failed - send failure email
      if (studentForEmail?.email) {
        const failureEmail = emailTemplatesExtra.paymentFailed(
          studentForEmail.displayName,
          claimedOrder.id,
          Number(claimedOrder.totalAmount)
        );
        try {
          const emailResult = await sendEmail({
            to: studentForEmail.email,
            subject: failureEmail.subject,
            html: failureEmail.html,
            text: failureEmail.text,
          });
          if (emailResult.success) {
            console.log(`[PayU Callback] Payment failure email sent for order ${claimedOrder.id}`);
          } else {
            console.error(`[PayU Callback] Failed to send payment failure email for order ${claimedOrder.id}:`, emailResult.error);
          }
        } catch (err) {
          console.error(`[PayU Callback] Exception sending payment failure email for order ${claimedOrder.id}:`, err);
        }
      }

      // Deep link flow: redirect to mobile app with failed status
      if (udf1 && isDeepLink(udf1)) {
        const deepLinkUrl = new URL(udf1);
        deepLinkUrl.searchParams.set("status", "failed");
        deepLinkUrl.searchParams.set("order_id", String(claimedOrder.id));
        if (failureReason) {
          deepLinkUrl.searchParams.set("reason", failureReason);
        }
        const response = new Response("Redirecting...", {
          status: 302,
          headers: { Location: deepLinkUrl.toString() },
        });
        if (userSession) {
          await setServerSession(response, userSession);
        }
        console.log(`[PayU Callback] Deep link failed redirect for order ${claimedOrder.id} to ${udf1}`);
        return response;
      }

      // Payment failed - preserve session cookie
      return createHtmlResponse({
        status: 'failed',
        txnid,
        redirectUrl: `${baseUrl}/cart?status=failed&order_id=${claimedOrder.id}${failureReason ? `&reason=${failureReason}` : ""}`,
        session: userSession ?? undefined,
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("[PayU Callback] Processing failed:", error.message);
    }
    return createHtmlResponse({
      status: 'failed',
      txnid: '',
      redirectUrl: `${baseUrl}/cart?error=processing_failed`,
    });
  }
}

async function createHtmlResponse(params: {
  status: 'success' | 'failed' | 'cancelled';
  txnid: string;
  redirectUrl: string;
  session?: Session;
}): Promise<Response> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Processing</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: hsl(220 20% 98%);
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid hsl(220 15% 90%);
      border-top-color: hsl(20 100% 70%);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .message {
      color: hsl(220 10% 20%);
      font-size: 1.1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <div class="message">Processing payment...</div>
  </div>
  <script>
    (function() {
      const status = ${serializeForInlineScript(params.status)};
      const txnid = ${serializeForInlineScript(params.txnid)};
      const redirectUrl = ${serializeForInlineScript(params.redirectUrl)};
      
      // Check if we're in a popup window
      if (window.opener && !window.opener.closed) {
        // We're in a popup - send message to parent and close
        try {
          window.opener.postMessage({
            type: 'payu_payment_complete',
            status: status,
            txnid: txnid
          }, '*');
          
          // Give the parent a moment to receive the message
          setTimeout(function() {
            window.close();
          }, 500);
        } catch (e) {
          console.error('Failed to communicate with parent window:', e);
          // Fallback to redirect if message fails
          window.location.href = redirectUrl;
        }
      } else {
        // Not in a popup - redirect as before
        window.location.href = redirectUrl;
      }
    })();
  </script>
</body>
</html>
`;

  const response = new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });

  // Set session cookie if provided to preserve user login
  if (params.session) {
    await setServerSession(response, params.session);
  }

  return response;
}