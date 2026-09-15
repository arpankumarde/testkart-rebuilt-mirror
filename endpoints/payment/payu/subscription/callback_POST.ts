import { db } from "../../../../helpers/db";
import { schema } from "./callback_POST.schema";
import { createHash } from "crypto";
import { setServerSession, Session } from "../../../../helpers/getSetServerSession";
import { sendEmail } from "../../../../helpers/sendEmail";
import {
  subscriptionActivated,
  subscriptionUpgraded,
  subscriptionPaymentFailed,
} from "../../../../helpers/emailTemplates";
import { refundOrphanedWalletSubscriptionPayment } from "../../../../helpers/refundOrphanedWalletSubscriptionPayment";
import { serializeForInlineScript } from "../../../../helpers/serializeForInlineScript";
import { extractPayUFailure } from "../../../../helpers/extractPayUFailure";
import { paymentFailureReason } from "../../../../helpers/paymentFailureReason";

export async function handle(request: Request): Promise<Response> {
  const baseUrl = "https://testkart.in";
  const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
  const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;
  const baseRedirectUrl = `${baseUrl}/teacher/subscription`;

  // Fast-fail on configuration errors
  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    console.error("[PayU Subscription] PayU merchant key or salt not configured");
    return createHtmlResponse({
      status: 'failed',
      txnid: '',
      redirectUrl: `${baseRedirectUrl}?error=payment_config`,
    });
  }

  try {
    const formData = await request.formData();
    const data = Object.fromEntries(formData.entries());
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
    } = validatedData;

    const hashString = `${PAYU_MERCHANT_SALT}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${PAYU_MERCHANT_KEY}`;
    const calculatedHash = createHash("sha512").update(hashString).digest("hex");

    // Fast-fail on invalid hash
    if (calculatedHash !== receivedHash) {
      console.error(`[PayU Subscription] Hash mismatch for txnid ${txnid}`);
      return createHtmlResponse({
        status: 'failed',
        txnid: '', // hash failed, so txnid is unverified input
        redirectUrl: `${baseRedirectUrl}?error=invalid_hash`,
      });
    }

    const transaction = await db
      .selectFrom("subscriptionTransactions")
      .innerJoin("subscriptionPlans", "subscriptionTransactions.planId", "subscriptionPlans.id")
      .selectAll("subscriptionTransactions")
      .select(["subscriptionPlans.durationDays", "subscriptionPlans.name as planName", "subscriptionPlans.price as planPrice"])
      .where("subscriptionTransactions.transactionId", "=", txnid)
      .where("subscriptionTransactions.status", "=", "pending")
      .executeTakeFirst();

    if (!transaction) {
      console.error(`[PayU Subscription] Transaction not found for txnid ${txnid}`);
      return await createHtmlResponse({
        status: 'failed',
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

    const session: Session | undefined = sessionRecord && sessionRecord.createdAt && sessionRecord.lastAccessed ? {
      id: sessionRecord.id,
      createdAt: new Date(sessionRecord.createdAt).getTime(),
      lastAccessed: new Date(sessionRecord.lastAccessed).getTime(),
      passwordChangeRequired: false,
      impersonatorAdminId: sessionRecord.impersonatorAdminId ?? undefined,
    } : undefined;

    if (status === "success") {
      // Fetch teacher info for email notifications
      const teacher = await db
        .selectFrom("users")
        .select(["displayName", "email as userEmail"])
        .where("id", "=", transaction.teacherId)
        .executeTakeFirst();

      // Check for existing active subscription (for upgrade detection) BEFORE deactivating
      const existingActiveSubscription = await db
        .selectFrom("teacherSubscriptions")
        .innerJoin("subscriptionPlans", "teacherSubscriptions.planId", "subscriptionPlans.id")
        .select("subscriptionPlans.name as oldPlanName")
        .where("teacherSubscriptions.teacherId", "=", transaction.teacherId)
        .where("teacherSubscriptions.status", "=", "active")
        .executeTakeFirst();

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
            `[PayU Subscription] Deactivated ${deactivatedCount.numUpdatedRows} existing active subscription(s) for teacherId=${transaction.teacherId} as part of upgrade`
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
            paymentMethod: "payu",
            autoRenew: true,
          })
          .returning("id")
          .execute();

        await trx
          .updateTable("subscriptionTransactions")
          .set({ 
            subscriptionId: newSubscription.id,
            status: "completed" 
          })
          .where("id", "=", transaction.id)
          .execute();

        // Link wallet portion of split payment if udf1 contains a wallet transaction ID
        if (udf1.startsWith("WALLET_")) {
          const walletTransactionId = udf1.slice("WALLET_".length);
          
          const walletSubTransaction = await trx
            .selectFrom("subscriptionTransactions")
            .select("id")
            .where("transactionId", "=", walletTransactionId)
            .executeTakeFirst();

          if (walletSubTransaction) {
            await trx
              .updateTable("subscriptionTransactions")
              .set({ subscriptionId: newSubscription.id })
              .where("id", "=", walletSubTransaction.id)
              .execute();
            console.log(`[PayU Subscription] Linked wallet transaction ${walletTransactionId} to subscription ${newSubscription.id}`);
          } else {
            console.warn(`[PayU Subscription] Wallet transaction not found for ID: ${walletTransactionId}`);
          }
        }

        // Auto-verify teacher on paid subscription
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
          // This is an upgrade
          await sendEmail({
            to: teacherEmail,
            ...subscriptionUpgraded(teacherName, oldPlanName, planName, amountNumber, startDate, endDate),
          }).catch(err => console.error("[PayU Subscription] Failed to send upgrade email:", err));
        } else {
          // This is a new subscription
          await sendEmail({
            to: teacherEmail,
            ...subscriptionActivated(teacherName, planName, amountNumber, startDate, endDate),
          }).catch(err => console.error("[PayU Subscription] Failed to send activation email:", err));
        }
      }

      return await createHtmlResponse({
        status: 'success',
        txnid,
        redirectUrl: `${baseRedirectUrl}?status=success&txnid=${txnid}`,
        session,
      });
    } else {
      const isCancelled = status === "userCancelled" || status.toLowerCase().includes("cancel");
      
      if (isCancelled) {
        // The PayU leg is left "pending" (unchanged) so the existing retry
        // flow in wallet-subscribe_POST.ts can supersede it — but if this was
        // a wallet+PayU split payment, the wallet leg was already deducted
        // and must be refunded now, not left stuck.
        await db.transaction().execute(async (trx) => {
          await refundOrphanedWalletSubscriptionPayment(trx, transaction.teacherId, txnid);
        });

        return await createHtmlResponse({
          status: 'cancelled',
          txnid,
          redirectUrl: `${baseRedirectUrl}?cancelled=true&txnid=${txnid}`,
          session,
        });
      } else {
        // PayU's reason fields are not covered by the response hash; only the hashed status decides the outcome.
        const failureColumns = extractPayUFailure(validatedData);
        const failureReason = paymentFailureReason.describe(failureColumns)?.reason;

        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable("subscriptionTransactions")
            .set({ status: "failed", ...failureColumns })
            .where("id", "=", transaction.id)
            .execute();

          // Refund the wallet leg of a split wallet+PayU payment — the PayU
          // portion failed, so the subscription was never granted and the
          // wallet deduction should not stick.
          await refundOrphanedWalletSubscriptionPayment(trx, transaction.teacherId, txnid);
        });

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
            }).catch(err => console.error("[PayU Subscription] Failed to send payment failed email:", err));
          }
        } catch (err) {
          console.error("[PayU Subscription] Failed to fetch teacher for failure email:", err);
        }

        return await createHtmlResponse({
          status: 'failed',
          txnid,
          redirectUrl: `${baseRedirectUrl}?status=failed&txnid=${txnid}${failureReason ? `&reason=${failureReason}` : ""}`,
          session,
        });
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("[PayU Subscription] Processing failed:", error.message);
    }
    return await createHtmlResponse({
      status: 'failed',
      txnid: '',
      redirectUrl: `${baseRedirectUrl}?error=processing_failed`,
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

  if (params.session) {
    await setServerSession(response, params.session);
  }

  return response;
}