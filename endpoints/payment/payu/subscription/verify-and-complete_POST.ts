import { db } from "../../../../helpers/db";
import { schema, OutputType } from "./verify-and-complete_POST.schema";
import superjson from 'superjson';
import { createHash } from "crypto";
import { Transaction } from "kysely";
import { DB } from "../../../../helpers/schema";
import { sendEmail } from "../../../../helpers/sendEmail";
import { subscriptionActivated } from "../../../../helpers/emailTemplates";
import { extractPayUFailure } from "../../../../helpers/extractPayUFailure";
import { paymentFailureReason } from "../../../../helpers/paymentFailureReason";
import { payuLogFields } from "../../../../helpers/payuLogFields";

// Type definition for the expected structure of PayU's verify payment API response
type PayUVerifyResponse = {
  status: number;
  msg: string;
  transaction_details: {
    [txnid: string]: {
      mihpayid: string;
      status: "success" | "pending" | "failure" | string; // PayU status can vary
      txnid: string;
      amount: string;
      unmappedstatus?: string;
      error_code?: string;
      error_Message?: string;
      field9?: string;
      // ... other fields
    };
  };
};

async function completeSubscriptionTransaction(
  transaction: {
    id: number;
    teacherId: number;
    planId: number;
    durationDays: number;
  },
  trx: Transaction<DB>
) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + transaction.durationDays);

  const [newSubscription] = await trx
    .insertInto("teacherSubscriptions")
    .values({
      teacherId: transaction.teacherId,
      planId: transaction.planId,
      status: "active",
      startDate,
      endDate,
      paymentMethod: "payu",
      autoRenew: true, // Defaulting to true as per callback logic
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

  // Auto-verify teacher on paid subscription
  await trx
    .updateTable("users")
    .set({ isVerified: true })
    .where("id", "=", transaction.teacherId)
    .execute();
  
  return { subscriptionId: newSubscription.id, startDate, endDate };
}

export async function handle(request: Request): Promise<Response> {
  const startTime = performance.now();
  console.log("[PayU Sub Verify] Received subscription verification request");

  const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
  const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    console.error("[PayU Sub Verify] ERROR: PayU merchant key or salt is not configured");
    return new Response(superjson.stringify({
      success: false,
      message: "Payment gateway not configured.",
      status: 'failed',
      transactionId: null,
    }), { status: 500 });
  }

  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    let transactionQuery = db
      .selectFrom("subscriptionTransactions")
      .innerJoin("subscriptionPlans", "subscriptionTransactions.planId", "subscriptionPlans.id")
      .selectAll("subscriptionTransactions")
      .select(["subscriptionPlans.durationDays", "subscriptionPlans.name as planName", "subscriptionPlans.price as planPrice"]);

    if (input.txnid) {
      transactionQuery = transactionQuery.where("subscriptionTransactions.transactionId", "=", input.txnid);
    } else if (input.transactionId) {
      transactionQuery = transactionQuery.where("subscriptionTransactions.id", "=", input.transactionId);
    } else {
      // Should be caught by schema validation, but here for safety
      return new Response(superjson.stringify({
        success: false,
        message: "Either txnid or transactionId must be provided.",
        status: 'failed',
        transactionId: null,
      }), { status: 400 });
    }

    const transaction = await transactionQuery.executeTakeFirst();

    if (!transaction) {
      console.error(`[PayU Sub Verify] ERROR: Subscription transaction not found for input:`, input);
      return new Response(superjson.stringify({
        success: false,
        message: "Subscription transaction not found.",
        status: 'failed',
        transactionId: input.transactionId ?? null,
      }), { status: 404 });
    }

    if (transaction.status === "completed") {
      console.log(`[PayU Sub Verify] Transaction ${transaction.id} already completed. Skipping verification.`);
      return new Response(superjson.stringify({
        success: true,
        status: "completed",
        transactionId: transaction.id,
        subscriptionId: transaction.subscriptionId,
        message: "Subscription already active.",
      } satisfies OutputType));
    }

    if (!transaction.transactionId) {
        console.error(`[PayU Sub Verify] ERROR: Transaction ${transaction.id} has no PayU transaction ID (txnid)`);
        return new Response(superjson.stringify({
          success: false,
          message: "Transaction is missing PayU ID.",
          status: 'failed',
          transactionId: transaction.id,
        }), { status: 400 });
    }
    const txnid = transaction.transactionId;

    const command = "verify_payment";
    const hashString = `${PAYU_MERCHANT_KEY}|${command}|${txnid}|${PAYU_MERCHANT_SALT}`;
    const hash = createHash("sha512").update(hashString).digest("hex");

    const formData = new URLSearchParams();
    formData.append("key", PAYU_MERCHANT_KEY);
    formData.append("command", command);
    formData.append("var1", txnid);
    formData.append("hash", hash);

    console.log(`[PayU Sub Verify] Calling PayU verify API for txnid ${txnid}`);
    const payuResponse = await fetch("https://info.payu.in/merchant/postservice?form=2", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    if (!payuResponse.ok) {
      throw new Error(`PayU API request failed with status ${payuResponse.status}`);
    }

    const payuData = (await payuResponse.json()) as PayUVerifyResponse;
    console.log(
      `[PayU Sub Verify] PayU API response received for txnid ${txnid}:`,
      JSON.stringify({ apiStatus: payuData?.status, ...payuLogFields(payuData?.transaction_details?.[txnid]) })
    );

    const transactionDetails = payuData.transaction_details[txnid];
    if (!transactionDetails) {
      throw new Error("Transaction details not found in PayU response.");
    }

    const payuStatus = transactionDetails.status;

    if (payuStatus === "success") {
      console.log(`[PayU Sub Verify] PayU confirmed success for txnid ${txnid}. Attempting to complete transaction ${transaction.id}.`);

      const result = await db.transaction().execute(async (trx) => {
        const updatedTransaction = await trx
          .updateTable("subscriptionTransactions")
          .set({ status: "pending" }) // No-op, just to lock and check
          .where("id", "=", transaction.id)
          .where("status", "=", "pending")
          .returningAll()
          .executeTakeFirst();

        if (!updatedTransaction) {
          return null; // Already processed by another request
        }

        const completed = await completeSubscriptionTransaction(
          { ...transaction, durationDays: transaction.durationDays },
          trx
        );
        return completed;
      });

      if (result) {
        console.log(`[PayU Sub Verify] Successfully completed transaction ${transaction.id} for txnid ${txnid}.`);

        // Activation email (only when this request created the subscription)
        try {
          const teacher = await db
            .selectFrom("users")
            .select(["displayName", "email"])
            .where("id", "=", transaction.teacherId)
            .executeTakeFirst();

          if (teacher && teacher.email) {
            const amountNumber = parseFloat(transaction.planPrice);
            await sendEmail({
              to: teacher.email,
              ...subscriptionActivated(teacher.displayName, transaction.planName, amountNumber, result.startDate, result.endDate),
            }).catch(err => console.error("[PayU Sub Verify] Failed to send activation email:", err));
          }
        } catch (err) {
          console.error("[PayU Sub Verify] Failed to fetch teacher for activation email:", err);
        }
        return new Response(superjson.stringify({
          success: true,
          status: "completed",
          transactionId: transaction.id,
          subscriptionId: result.subscriptionId,
          message: "Payment verified and subscription activated.",
        } satisfies OutputType));
      } else {
        console.log(`[PayU Sub Verify] Transaction ${transaction.id} was already processed while verifying. Returning current status.`);
        const currentTransaction = await db.selectFrom("subscriptionTransactions").selectAll().where("id", "=", transaction.id).executeTakeFirstOrThrow();
        return new Response(superjson.stringify({
          success: true,
          status: currentTransaction.status === 'refunded' ? 'failed' : currentTransaction.status as 'pending' | 'completed' | 'failed',
          transactionId: currentTransaction.id,
          subscriptionId: currentTransaction.subscriptionId,
          message: "Subscription was activated by another request.",
        } satisfies OutputType));
      }
    }

    const finalStatus = payuStatus === "failure" ? "failed" : "pending";
    const failure =
      finalStatus === "failed" ? paymentFailureReason.describe(extractPayUFailure(transactionDetails)) : null;
    console.log(`[PayU Sub Verify] PayU status is '${payuStatus}' for txnid ${txnid}. Transaction ${transaction.id} remains '${transaction.status}'.`);
    return new Response(superjson.stringify({
      success: true,
      status: finalStatus,
      transactionId: transaction.id,
      message: failure ? failure.payerMessage : `Payment status is ${payuStatus}.`,
    } satisfies OutputType));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[PayU Sub Verify] ERROR: Verification failed:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(superjson.stringify({
      success: false,
      message: errorMessage,
      status: 'failed',
      transactionId: null,
    }), { status: 500 });
  } finally {
    console.log(`[PayU Sub Verify] Total handler time: ${performance.now() - startTime}ms`);
  }
}