import { db } from "../../../../helpers/db";
import { schema } from "./mandate-callback_POST.schema";
import { createHash } from "crypto";
import { setServerSession, Session } from "../../../../helpers/getSetServerSession";
import { sendEmail } from "../../../../helpers/sendEmail";
import {
  subscriptionActivated,
  subscriptionUpgraded,
  subscriptionPaymentFailed,
} from "../../../../helpers/emailTemplates";
import { serializeForInlineScript } from "../../../../helpers/serializeForInlineScript";
import { extractPayUFailure } from "../../../../helpers/extractPayUFailure";
import { paymentFailureReason } from "../../../../helpers/paymentFailureReason";
import { payuLogFields } from "../../../../helpers/payuLogFields";

export async function handle(request: Request) {
  const baseUrl = "https://testkart.in";
  const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
  const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;
  const baseRedirectUrl = `${baseUrl}/teacher/subscription`;

  // Fast-fail on configuration errors
  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    console.error("[PayU Mandate] PayU merchant key or salt not configured");
    return createHtmlResponse({
      status: "failed",
      txnid: "",
      redirectUrl: `${baseRedirectUrl}?error=payment_config`,
    });
  }

  try {
    const formData = await request.formData();
    const data = Object.fromEntries(formData.entries());

    const receivedKeys = Object.keys(data);
    console.log(
      "[PayU Mandate] Received callback fields:",
      JSON.stringify({ ...payuLogFields(data), fieldNames: receivedKeys })
    );

    const validatedData = schema.parse(data);

    const {
      status,
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
      mihpayid,
      mode,
    } = validatedData;

    // Hash verification MUST use udf1/udf2 values as they were in the original request,
    // regardless of where mandate details actually appear in the callback.
    const hashString = `${PAYU_MERCHANT_SALT}|${status}||||||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${PAYU_MERCHANT_KEY}`;
    const calculatedHash = createHash("sha512").update(hashString).digest("hex");

    // Fast-fail on invalid hash
    if (calculatedHash !== receivedHash) {
      console.error(`[PayU Mandate] Hash mismatch for txnid ${txnid}. Received keys: ${receivedKeys.join(", ")}`);
      return createHtmlResponse({
        status: "failed",
        txnid: "", // hash failed, so txnid is unverified input
        redirectUrl: `${baseRedirectUrl}?error=invalid_hash`,
      });
    }

    // mihpayid from PayU is the mandate ID (authPayuId) used for all future SI API calls.
    // PayU does not send a separate mandate_status field in the SI callback; if status is "success", the mandate is active.
    console.log(
      `[PayU Mandate] txnid=${txnid} status=${status} mihpayid=${mihpayid || "(empty)"}`
    );

    const transaction = await db
      .selectFrom("subscriptionTransactions")
      .innerJoin("subscriptionPlans", "subscriptionTransactions.planId", "subscriptionPlans.id")
      .selectAll("subscriptionTransactions")
      .select(["subscriptionPlans.durationDays", "subscriptionPlans.price as planPrice", "subscriptionPlans.name as planName"])
      .where("subscriptionTransactions.transactionId", "=", txnid)
      .where("subscriptionTransactions.status", "=", "pending")
      .executeTakeFirst();

    if (!transaction) {
      console.error(`[PayU Mandate] Transaction not found for txnid ${txnid}`);
      return await createHtmlResponse({
        status: "failed",
        txnid,
        redirectUrl: `${baseRedirectUrl}?error=transaction_not_found`,
      });
    }

    // Fetch the teacher's session to preserve it after the callback
    const sessionRecord = await db
      .selectFrom("sessions")
      .selectAll()
      .where("userId", "=", transaction.teacherId)
      .orderBy("lastAccessed", "desc")
      .executeTakeFirst();

    const session: Session | undefined =
      sessionRecord && sessionRecord.createdAt && sessionRecord.lastAccessed
        ? {
            id: sessionRecord.id,
            createdAt: new Date(sessionRecord.createdAt).getTime(),
            lastAccessed: new Date(sessionRecord.lastAccessed).getTime(),
            passwordChangeRequired: false,
            impersonatorAdminId: sessionRecord.impersonatorAdminId ?? undefined,
          }
        : undefined;

    if (status === "success" && mihpayid) {
      // Fetch teacher info and check for existing active subscription BEFORE deactivating
      const [teacher, existingActiveSubscription] = await Promise.all([
        db
          .selectFrom("users")
          .select(["displayName", "email as userEmail"])
          .where("id", "=", transaction.teacherId)
          .executeTakeFirst(),
        db
          .selectFrom("teacherSubscriptions")
          .innerJoin("subscriptionPlans", "teacherSubscriptions.planId", "subscriptionPlans.id")
          .select("subscriptionPlans.name as oldPlanName")
          .where("teacherSubscriptions.teacherId", "=", transaction.teacherId)
          .where("teacherSubscriptions.status", "=", "active")
          .executeTakeFirst(),
      ]);

      const oldPlanName = existingActiveSubscription?.oldPlanName ?? null;
      let startDate!: Date;
      let endDate!: Date;

      await db.transaction().execute(async (trx) => {
        startDate = new Date();
        endDate = new Date();
        endDate.setDate(startDate.getDate() + transaction.durationDays);

        // Deactivate any existing active subscriptions for this teacher (subscription upgrade)
        const deactivatedCount = await trx
          .updateTable("teacherSubscriptions")
          .set({
            status: "expired",
            endDate: startDate,
            updatedAt: startDate,
          })
          .where("teacherId", "=", transaction.teacherId)
          .where("status", "=", "active")
          .executeTakeFirst();

        if (deactivatedCount.numUpdatedRows > 0n) {
          console.log(
            `[PayU Mandate] Deactivated ${deactivatedCount.numUpdatedRows} existing active subscription(s) for teacherId=${transaction.teacherId} as part of upgrade`
          );
        }

        const [newSubscription] = await trx
          .insertInto("teacherSubscriptions")
          .values({
            teacherId: transaction.teacherId,
            planId: transaction.planId,
            status: "active",
            startDate,
            endDate,
            paymentMethod: "payu_recurring",
            autoRenew: true,
            mandateId: mihpayid,
            mandateStatus: "active",
            mandateMaxAmount: transaction.planPrice,
            mandateStartDate: startDate,
            mandateEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
            mandateFrequency: transaction.durationDays > 31 ? "YEARLY" : "MONTHLY",
            mandatePaymentMode: mode,
            lastChargeDate: startDate,
            nextChargeDate: endDate,
          })
          .returning("id")
          .execute();

        await trx
          .updateTable("subscriptionTransactions")
          .set({
            subscriptionId: newSubscription.id,
            status: "completed",
          })
          .where("id", "=", transaction.id)
          .execute();

        // Auto-verify teacher similar to one-time subscription callback
        await trx
          .updateTable("users")
          .set({ isVerified: true })
          .where("id", "=", transaction.teacherId)
          .execute();
      });

      // Email notification after transaction commits
      if (teacher) {
        const teacherEmail = teacher.userEmail ?? email;
        const teacherName = teacher.displayName;
        const planName = transaction.planName;
        const amountNumber = parseFloat(transaction.planPrice);

        if (oldPlanName) {
          await sendEmail({
            to: teacherEmail,
            ...subscriptionUpgraded(teacherName, oldPlanName, planName, amountNumber, startDate, endDate),
          }).catch(err => console.error("[PayU Mandate] Failed to send upgrade email:", err));
        } else {
          await sendEmail({
            to: teacherEmail,
            ...subscriptionActivated(teacherName, planName, amountNumber, startDate, endDate),
          }).catch(err => console.error("[PayU Mandate] Failed to send activation email:", err));
        }
      }

      console.log(`[PayU Mandate] Success: new subscription created for txnid=${txnid} teacherId=${transaction.teacherId}`);
      return await createHtmlResponse({
        status: "success",
        txnid,
        redirectUrl: `${baseRedirectUrl}?status=mandate_created&txnid=${txnid}`,
        session,
      });
    } else if (status === "success") {
      // Payment succeeded but mihpayid is missing - extremely unlikely, log loudly and fail
      console.error(
        `[PayU Mandate] Payment success but mihpayid missing for txnid=${txnid}. ` +
        `Received field keys: ${receivedKeys.join(", ")}`
      );

      await db
        .updateTable("subscriptionTransactions")
        .set({ status: "failed" })
        .where("id", "=", transaction.id)
        .execute();

      // Failure email for mihpayid missing case
      try {
        const teacher = await db
          .selectFrom("users")
          .select(["displayName", "email as userEmail"])
          .where("id", "=", transaction.teacherId)
          .executeTakeFirst();

        if (teacher) {
          const teacherEmail = teacher.userEmail ?? email;
          const amountNumber = parseFloat(transaction.planPrice);
          await sendEmail({
            to: teacherEmail,
            ...subscriptionPaymentFailed(teacher.displayName, transaction.planName, amountNumber),
          }).catch(err => console.error("[PayU Mandate] Failed to send mihpayid missing email:", err));
        }
      } catch (err) {
        console.error("[PayU Mandate] Failed to fetch teacher for mihpayid missing email:", err);
      }

      return await createHtmlResponse({
        status: "failed",
        txnid,
        redirectUrl: `${baseRedirectUrl}?status=failed&txnid=${txnid}&reason=mihpayid_missing`,
        session,
      });
    } else {
      const isCancelled =
        status === "userCancelled" || status.toLowerCase().includes("cancel");

      if (isCancelled) {
        return await createHtmlResponse({
          status: "cancelled",
          txnid,
          redirectUrl: `${baseRedirectUrl}?cancelled=true&txnid=${txnid}`,
          session,
        });
      } else {
        // PayU's reason fields are not covered by the response hash; only the hashed status decides the outcome.
        const failureColumns = extractPayUFailure(validatedData);
        const failureReason = paymentFailureReason.describe(failureColumns)?.reason;

        await db
          .updateTable("subscriptionTransactions")
          .set({ status: "failed", ...failureColumns })
          .where("id", "=", transaction.id)
          .execute();

        // Payment failure email
        try {
          const teacher = await db
            .selectFrom("users")
            .select(["displayName", "email as userEmail"])
            .where("id", "=", transaction.teacherId)
            .executeTakeFirst();

          if (teacher) {
            const teacherEmail = teacher.userEmail ?? email;
            const amountNumber = parseFloat(transaction.planPrice);
            await sendEmail({
              to: teacherEmail,
              ...subscriptionPaymentFailed(teacher.displayName, transaction.planName, amountNumber),
            }).catch(err => console.error("[PayU Mandate] Failed to send payment failed email:", err));
          }
        } catch (err) {
          console.error("[PayU Mandate] Failed to fetch teacher for failure email:", err);
        }

        return await createHtmlResponse({
          status: "failed",
          txnid,
          redirectUrl: `${baseRedirectUrl}?status=failed&txnid=${txnid}${failureReason ? `&reason=${failureReason}` : ""}`,
          session,
        });
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("[PayU Mandate] Processing failed:", error.message);
    }
    return await createHtmlResponse({
      status: "failed",
      txnid: "",
      redirectUrl: `${baseRedirectUrl}?error=processing_failed`,
    });
  }
}

async function createHtmlResponse(params: {
  status: "success" | "failed" | "cancelled";
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
      "Content-Type": "text/html; charset=utf-8",
    },
  });

  if (params.session) {
    await setServerSession(response, params.session);
  }

  return response;
}