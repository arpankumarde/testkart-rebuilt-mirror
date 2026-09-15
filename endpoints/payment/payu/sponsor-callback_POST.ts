import { db } from "../../../helpers/db";
import { schema } from "./sponsor-callback_POST.schema";
import { createHash } from "crypto";
import { sql } from "kysely";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import { sendEmail } from "../../../helpers/sendEmail";
import { serializeForInlineScript } from "../../../helpers/serializeForInlineScript";
import { extractPayUFailure, isPayUCancellation } from "../../../helpers/extractPayUFailure";

export async function handle(request: Request) {
  const baseUrl = "https://testkart.in";
  const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
  const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

  // Fast-fail on configuration errors
  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    console.error("[PayU Sponsor Callback] PayU merchant key or salt not configured");
    return createHtmlResponse({
      status: 'failed',
      txnid: '',
      redirectUrl: `${baseUrl}/teacher/students?sponsored=failed&reason=config_error`,
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
    const hashString = additionalCharges && additionalCharges !== ""
      ? `${additionalCharges}|${PAYU_MERCHANT_SALT}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${PAYU_MERCHANT_KEY}`
      : `${PAYU_MERCHANT_SALT}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${PAYU_MERCHANT_KEY}`;

    const calculatedHash = createHash("sha512").update(hashString).digest("hex");

    // Fast-fail on invalid hash
    if (calculatedHash.toLowerCase() !== receivedHash.toLowerCase()) {
      console.error(`[PayU Sponsor Callback] Hash mismatch for txnid ${txnid}`);
      return createHtmlResponse({
        status: 'failed',
        txnid: '', // hash failed, so txnid is unverified input
        redirectUrl: `${baseUrl}/teacher/students?sponsored=failed&reason=invalid_hash`,
      });
    }

    // PayU's reason fields are not covered by the response hash; only the hashed status decides the outcome.
    const failureColumns = extractPayUFailure(validatedData);

    // Handle cancellation (Cancel or Back pressed on the PayU page)
    if (isPayUCancellation({ status, unmappedstatus })) {
      await db
        .updateTable("orders")
        .set({ status: "cancelled", ...failureColumns })
        .where("paymentTransactionId", "=", txnid)
        .where("status", "=", "pending")
        .execute();

      return createHtmlResponse({
        status: 'cancelled',
        txnid,
        redirectUrl: `${baseUrl}/teacher/students?sponsored=cancelled`,
      });
    }

    // Determine new status
    const newStatus: "completed" | "failed" = status === "success" ? "completed" : "failed";

    // Single transaction for all database operations
    const result = await db.transaction().execute(async (trx) => {
      // 1. Atomic order claim - only update if status is still 'pending'
      const claimedOrder = await trx
        .updateTable("orders")
        .set(newStatus === "failed" ? { status: newStatus, ...failureColumns } : { status: newStatus })
        .where("paymentTransactionId", "=", txnid)
        .where("status", "=", "pending")
        .returningAll()
        .executeTakeFirst();

      if (!claimedOrder) {
        // If order not found or not pending, check if it was already completed
        const existingOrder = await trx
          .selectFrom("orders")
          .select(["id", "status"])
          .where("paymentTransactionId", "=", txnid)
          .executeTakeFirst();

        if (existingOrder && existingOrder.status === 'completed') {
          return { status: 'already_completed', orderId: existingOrder.id };
        }
        return null;
      }

      // If payment failed, fetch teacher info for failure email and return
      if (newStatus === "failed") {
        const teacherUserFailed = await trx
          .selectFrom("users")
          .select(["displayName", "email"])
          .where("id", "=", claimedOrder.userId)
          .executeTakeFirst();

        return {
          status: 'failed',
          orderId: claimedOrder.id,
          teacherEmail: teacherUserFailed?.email ?? null,
          teacherName: teacherUserFailed?.displayName ?? "Teacher",
          paidAmount: parseFloat(claimedOrder.totalAmount as string),
        };
      }

      // 2. Get the pending sponsorship record
      const sponsorship = await trx
        .selectFrom("teacherSponsoredEnrollments")
        .selectAll()
        .where("orderId", "=", claimedOrder.id)
        .executeTakeFirst();

      if (!sponsorship) {
        throw new Error(`Sponsorship record not found for order ${claimedOrder.id}`);
      }

      if (sponsorship.studentId === null) {
        throw new Error(`Sponsored student for order ${claimedOrder.id} closed their account before the payment completed`);
      }

      // NOTE: teacherSponsoredEnrollments.contentType is written by
      // endpoints/teacher/sponsor-student/enroll_POST.ts using the values
      // "test" | "course" | "product" | "bundle" (see sponsorshipValues
      // there) — NOT the "mock_test"/"digital_product"/"course_bundle"
      // values used elsewhere for content-review types. Must match those.
      const contentType = sponsorship.contentType ?? "test";

      // 3. Fetch content info based on contentType
      let contentTitle = "Content";
      if (contentType === "test" && sponsorship.mockTestId !== null) {
        const mockTestRow = await trx
          .selectFrom("mockTests")
          .select("title")
          .where("id", "=", sponsorship.mockTestId)
          .executeTakeFirst();
        contentTitle = mockTestRow?.title ?? "Test";
      } else if (contentType === "course" && sponsorship.courseId !== null) {
        const courseRow = await trx
          .selectFrom("courses")
          .select("title")
          .where("id", "=", sponsorship.courseId)
          .executeTakeFirst();
        contentTitle = courseRow?.title ?? "Course";
      } else if (contentType === "product" && sponsorship.digitalProductId !== null) {
        const productRow = await trx
          .selectFrom("digitalProducts")
          .select("title")
          .where("id", "=", sponsorship.digitalProductId)
          .executeTakeFirst();
        contentTitle = productRow?.title ?? "Digital Product";
      } else if (contentType === "bundle" && sponsorship.bundleId !== null) {
        const bundleRow = await trx
          .selectFrom("courseBundles")
          .select("title")
          .where("id", "=", sponsorship.bundleId)
          .executeTakeFirst();
        contentTitle = bundleRow?.title ?? "Bundle";
      }

      // Fetch teacher and student info for email notifications
      const [teacherUser, studentUser] = await Promise.all([
        trx
          .selectFrom("users")
          .select(["displayName", "email"])
          .where("id", "=", claimedOrder.userId)
          .executeTakeFirst(),
        trx
          .selectFrom("users")
          .select(["displayName", "email"])
          .where("id", "=", sponsorship.studentId)
          .executeTakeFirst(),
      ]);

      // 4. Update sponsorship record
      await trx
        .updateTable("teacherSponsoredEnrollments")
        .set({
          paymentMethod: 'online_payment',
          paymentTransactionId: txnid,
        })
        .where("id", "=", sponsorship.id)
        .execute();

      // 5. Create order item and enrollment based on contentType
      if (contentType === "test" && sponsorship.mockTestId !== null) {
        const mockTestId = sponsorship.mockTestId;

        await trx
          .insertInto("orderItems")
          .values({
            orderId: claimedOrder.id,
            mockTestId,
            quantity: 1,
            priceAtPurchase: sponsorship.testPrice,
            discountAmount: 0,
            platformFeePercentage: sponsorship.platformFeePercentage,
          })
          .execute();

        await trx
          .updateTable("mockTests")
          .set({ studentsEnrolled: sql`students_enrolled + 1` })
          .where("id", "=", mockTestId)
          .execute();

        await trx
          .insertInto("mockTestEnrollments")
          .values({
            mockTestId,
            studentId: sponsorship.studentId,
            orderId: claimedOrder.id,
            enrolledAt: new Date(),
            createdAt: new Date(),
          })
          .onConflict((oc) => oc.doNothing())
          .execute();

      } else if (contentType === "course" && sponsorship.courseId !== null) {
        const courseId = sponsorship.courseId;

        await trx
          .insertInto("orderItems")
          .values({
            orderId: claimedOrder.id,
            courseId,
            quantity: 1,
            priceAtPurchase: sponsorship.testPrice,
            discountAmount: 0,
            platformFeePercentage: sponsorship.platformFeePercentage,
          })
          .execute();

        await trx
          .insertInto("courseEnrollments")
          .values({
            studentId: sponsorship.studentId,
            courseId,
            enrolledAt: new Date(),
          })
          .onConflict((oc) => oc.columns(["studentId", "courseId"]).doNothing())
          .execute();

      } else if (contentType === "product" && sponsorship.digitalProductId !== null) {
        const productId = sponsorship.digitalProductId;

        await trx
          .insertInto("orderItems")
          .values({
            orderId: claimedOrder.id,
            digitalProductId: productId,
            quantity: 1,
            priceAtPurchase: sponsorship.testPrice,
            discountAmount: 0,
            platformFeePercentage: sponsorship.platformFeePercentage,
          })
          .execute();

        await trx
          .insertInto("digitalProductPurchases")
          .values({
            studentId: sponsorship.studentId,
            productId,
            orderId: claimedOrder.id,
            purchasedAt: new Date(),
          })
          .onConflict((oc) => oc.columns(["studentId", "productId"]).doNothing())
          .execute();

        await trx
          .updateTable("digitalProducts")
          .set((eb) => ({ totalPurchases: eb("totalPurchases", "+", 1) }))
          .where("id", "=", productId)
          .execute();

      } else if (contentType === "bundle" && sponsorship.bundleId !== null) {
        const bundleId = sponsorship.bundleId;

        // Update order with bundleId
        await trx
          .updateTable("orders")
          .set({ bundleId })
          .where("id", "=", claimedOrder.id)
          .execute();

        await trx
          .insertInto("bundleEnrollments")
          .values({
            bundleId,
            studentId: sponsorship.studentId,
            orderId: claimedOrder.id,
            enrolledAt: new Date(),
          })
          .execute();

      } else {
        throw new Error(`Unsupported contentType "${contentType}" or missing content ID for sponsorship ${sponsorship.id}`);
      }

      // 6. Handle new user notification
      if (sponsorship.wasNewUser) {
        console.log(`[PayU Sponsor Callback] Should send welcome SMS to ${sponsorship.studentPhone} for new user enrolled in "${contentTitle}"`);

        await trx
          .updateTable("teacherSponsoredEnrollments")
          .set({ temporaryPasswordSent: true })
          .where("id", "=", sponsorship.id)
          .execute();
      }

      return {
        status: 'completed',
        orderId: claimedOrder.id,
        teacherEmail: teacherUser?.email ?? null,
        teacherName: teacherUser?.displayName ?? "Teacher",
        studentEmail: studentUser?.email ?? null,
        studentName: studentUser?.displayName ?? "Student",
        contentTitle,
        paidAmount: parseFloat(claimedOrder.totalAmount as string),
      };
    });

    if (!result) {
      return createHtmlResponse({
        status: 'failed',
        txnid,
        redirectUrl: `${baseUrl}/teacher/students?sponsored=failed&reason=order_state_invalid`,
      });
    }

    if (result.status === 'already_completed') {
      return createHtmlResponse({
        status: 'success',
        txnid,
        redirectUrl: `${baseUrl}/teacher/students?sponsored=success&order_id=${result.orderId}`,
      });
    }

    if (result.status === 'failed') {
      // Payment failure email to teacher
      if (result.teacherEmail) {
        const template = emailTemplatesExtra.paymentFailed(
          result.teacherName,
          result.orderId,
          result.paidAmount
        );
        await sendEmail({
          to: result.teacherEmail,
          subject: template.subject,
          html: template.html,
          text: template.text,
        }).catch((err) => {
          console.error("[PayU Sponsor Callback] Failed to send payment failure email to teacher:", err);
        });
      }

      return createHtmlResponse({
        status: 'failed',
        txnid,
        redirectUrl: `${baseUrl}/teacher/students?sponsored=failed&order_id=${result.orderId}`,
      });
    }

    // Success - emails to teacher and student
    if (result.teacherEmail) {
      const template = emailTemplatesExtra.newPurchaseNotification(
        result.teacherName,
        result.studentName ?? "Student",
        result.contentTitle ?? "Content",
        'sponsored',
        result.paidAmount ?? 0
      );
      await sendEmail({
        to: result.teacherEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      }).catch((err) => {
        console.error("[PayU Sponsor Callback] Failed to send purchase notification to teacher:", err);
      });
    }

    if (result.studentEmail) {
      const template = emailTemplatesExtra.freeTestEnrollment(
        result.studentName ?? "Student",
        result.contentTitle ?? "Content",
        result.teacherName
      );
      await sendEmail({
        to: result.studentEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      }).catch((err) => {
        console.error("[PayU Sponsor Callback] Failed to send enrollment email to student:", err);
      });
    }

    return createHtmlResponse({
      status: 'success',
      txnid,
      redirectUrl: `${baseUrl}/teacher/students?sponsored=success&order_id=${result.orderId}`,
    });

  } catch (error) {
    if (error instanceof Error) {
      console.error("[PayU Sponsor Callback] Processing failed:", error.message);
    }
    return createHtmlResponse({
      status: 'failed',
      txnid: '',
      redirectUrl: `${baseUrl}/teacher/students?sponsored=failed&reason=processing_error`,
    });
  }
}

function createHtmlResponse(params: {
  status: 'success' | 'failed' | 'cancelled';
  txnid: string;
  redirectUrl: string;
}): Response {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sponsorship Payment Processing</title>
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
    <div class="message">Finalizing sponsorship...</div>
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
            type: 'payu_sponsor_payment_complete',
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

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}