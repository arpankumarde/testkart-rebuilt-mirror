import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { verifyPayUPayment } from "../../../helpers/verifyPayUPayment";
import { schema, OutputType } from "./reconcile_POST.schema";
import superjson from "superjson";
import { sendEmail } from "../../../helpers/sendEmail";
import { subscriptionActivated } from "../../../helpers/emailTemplates";

export async function handle(request: Request) {
  try {
    // 1. Verify admin authentication
    await getAdminServerSessionOrThrow(request);

    // 2. Parse and validate input
    const json = superjson.parse(await request.text());
    const { transactionId } = schema.parse(json);

    // 3. Fetch the transaction to perform initial checks
    const transaction = await db
      .selectFrom("subscriptionTransactions")
      .select(["id", "status", "transactionId as payuTxnId", "teacherId", "planId", "amount"])
      .where("id", "=", transactionId)
      .executeTakeFirst();

    if (!transaction) {
      return new Response(
        superjson.stringify({
          success: false,
          message: "Subscription transaction not found",
          transaction: null,
        } satisfies OutputType),
        { status: 404 }
      );
    }

    if (transaction.status !== "pending") {
      return new Response(
        superjson.stringify({
          success: false,
          message: `Transaction is not in pending state (current status: ${transaction.status})`,
          transaction: {
            id: transaction.id,
            previousStatus: transaction.status,
            newStatus: transaction.status,
          },
        } satisfies OutputType),
        { status: 400 }
      );
    }

    if (!transaction.payuTxnId) {
      return new Response(
        superjson.stringify({
          success: false,
          message: "Transaction does not have a PayU transaction ID linked",
          transaction: null,
        } satisfies OutputType),
        { status: 400 }
      );
    }

    // 4. Call verifyPayUPayment helper
    const verificationResult = await verifyPayUPayment(transaction.payuTxnId);

    if (!verificationResult.success && verificationResult.status !== "failure") {
      // Technical error or not found (but not explicitly failed payment)
      return new Response(
        superjson.stringify({
          success: false,
          message: `Payment verification failed: ${verificationResult.error || verificationResult.status}`,
          transaction: {
            id: transaction.id,
            previousStatus: transaction.status,
            newStatus: transaction.status,
          },
          verificationDetails: verificationResult,
        } satisfies OutputType),
        { status: 400 }
      );
    }

    let finalStatus: "completed" | "failed" | "pending" | "refunded" = "pending" as "completed" | "failed" | "pending" | "refunded";
    let updated = false;
    let emailStartDate: Date | null = null;
    let emailEndDate: Date | null = null;

    // 5. Database transaction with row-level locking
    await db.transaction().execute(async (trx) => {
      // Lock the transaction row
      const lockedTransaction = await trx
        .selectFrom("subscriptionTransactions")
        .select(["status", "teacherId", "planId", "transactionId as payuTxnId"])
        .where("id", "=", transactionId)
        .forUpdate()
        .executeTakeFirst();

      // Re-check status inside transaction
      if (!lockedTransaction || lockedTransaction.status !== "pending") {
        finalStatus = lockedTransaction?.status || "pending";
        return; // Already processed by another request
      }

      if (verificationResult.status === "success") {
        // Fetch plan details to create the subscription
        const plan = await trx
          .selectFrom("subscriptionPlans")
          .select(["durationDays", "price"])
          .where("id", "=", lockedTransaction.planId)
          .executeTakeFirst();

        if (!plan) {
          throw new Error("Associated subscription plan not found");
        }

        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
        emailStartDate = startDate;
        emailEndDate = endDate;

        // Deactivate any existing active subscriptions for this teacher (upgrade path)
        await trx
          .updateTable("teacherSubscriptions")
          .set({
            status: "expired",
            endDate: startDate,
            updatedAt: startDate,
          })
          .where("teacherId", "=", lockedTransaction.teacherId)
          .where("status", "=", "active")
          .execute();

        // Create new active subscription
        const [newSubscription] = await trx
          .insertInto("teacherSubscriptions")
          .values({
            teacherId: lockedTransaction.teacherId,
            planId: lockedTransaction.planId,
            status: "active",
            startDate,
            endDate,
            paymentMethod: "payu_recurring",
            autoRenew: true,
            mandateId: lockedTransaction.payuTxnId, // fallback to txnid for missing explicit mandate id
            mandateStatus: "active",
            mandateMaxAmount: plan.price,
            mandateStartDate: startDate,
            mandateEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
            mandateFrequency: plan.durationDays > 31 ? "YEARLY" : "MONTHLY",
            lastChargeDate: startDate,
            nextChargeDate: endDate,
            updatedAt: new Date(),
          })
          .returning("id")
          .execute();

        // Update the transaction
        await trx
          .updateTable("subscriptionTransactions")
          .set({ 
            status: "completed", 
            subscriptionId: newSubscription.id 
          })
          .where("id", "=", transactionId)
          .execute();

        finalStatus = "completed";
        updated = true;
      } else if (verificationResult.status === "failure") {
        // Payment Failed
        await trx
          .updateTable("subscriptionTransactions")
          .set({ status: "failed", ...verificationResult.failure })
          .where("id", "=", transactionId)
          .execute();

        finalStatus = "failed";
        updated = true;
      }
      // If status is pending/other from PayU, we leave it as pending
    });

        // 6. Send email notifications after transaction commits
    if (updated && finalStatus === "completed" && emailStartDate && emailEndDate) {
      const capturedStartDate = emailStartDate;
      const capturedEndDate = emailEndDate;
      const capturedTeacherId = transaction.teacherId;
      const capturedPlanId = transaction.planId;
      const capturedAmount = Number(transaction.amount ?? 0);
      try {
        const teacher = await db
          .selectFrom("users")
          .select(["displayName", "email"])
          .where("id", "=", capturedTeacherId)
          .executeTakeFirst();

        if (!teacher || !teacher.email) return;
        
        const plan = await db
          .selectFrom("subscriptionPlans")
          .select(["name"])
          .where("id", "=", capturedPlanId)
          .executeTakeFirst();

        if (!plan) return;

        const template = subscriptionActivated(
          teacher.displayName,
          plan.name,
          capturedAmount,
          capturedStartDate,
          capturedEndDate
        );
        
        await sendEmail({
          to: teacher.email as string,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
      } catch (err) {
        console.error("[reconcile_POST] Failed to send subscription activated email:", err);
      }
    }

    // 7. Return response
    if (updated) {
      return new Response(
        superjson.stringify({
          success: true,
          message: `Transaction successfully reconciled to '${finalStatus}'`,
          transaction: {
            id: transactionId,
            previousStatus: "pending",
            newStatus: finalStatus,
          },
          verificationDetails: verificationResult,
        } satisfies OutputType)
      );
    } else {
      return new Response(
        superjson.stringify({
          success: false,
          message: `Transaction status remained '${finalStatus}'. PayU status: ${verificationResult.status}`,
          transaction: {
            id: transactionId,
            previousStatus: "pending",
            newStatus: finalStatus,
          },
          verificationDetails: verificationResult,
        } satisfies OutputType)
      );
    }
  } catch (error) {
    console.error("[ReconcileSubscriptionTransaction] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}