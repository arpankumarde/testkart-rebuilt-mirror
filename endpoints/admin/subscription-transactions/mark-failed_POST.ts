import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./mark-failed_POST.schema";
import superjson from "superjson";
import { sendEmail } from "../../../helpers/sendEmail";
import { subscriptionPaymentFailed } from "../../../helpers/emailTemplates";

export async function handle(request: Request) {
  try {
    // 1. Verify admin authentication
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    // 2. Parse and validate input
    const json = superjson.parse(await request.text());
    const { transactionId } = schema.parse(json);

    // 3. Fetch the transaction to verify it exists and is pending
    const transaction = await db
      .selectFrom("subscriptionTransactions")
      .select(["id", "status", "teacherId", "planId", "amount"])
      .where("id", "=", transactionId)
      .executeTakeFirst();

    if (!transaction) {
      console.warn(`[MarkSubscriptionTransactionFailed] Transaction not found: ${transactionId}`);
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
      console.warn(
        `[MarkSubscriptionTransactionFailed] Transaction ${transactionId} is not pending (current status: ${transaction.status})`
      );
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

    // 4. Update transaction status to failed in a DB transaction
    await db.transaction().execute(async (trx) => {
      // Lock the transaction row to prevent race conditions
      const lockedTransaction = await trx
        .selectFrom("subscriptionTransactions")
        .select(["status"])
        .where("id", "=", transactionId)
        .forUpdate()
        .executeTakeFirst();

      // Re-check status inside transaction
      if (!lockedTransaction || lockedTransaction.status !== "pending") {
        console.warn(
          `[MarkSubscriptionTransactionFailed] Transaction ${transactionId} status changed during transaction`
        );
        return;
      }

      // Update transaction status to failed
      await trx
        .updateTable("subscriptionTransactions")
        .set({ status: "failed" })
        .where("id", "=", transactionId)
        .execute();

      console.info(`[MarkSubscriptionTransactionFailed] Transaction ${transactionId} marked as failed`);
    });

    // 5. Send payment failed email
    try {
      const capturedTeacherId = transaction.teacherId;
      const capturedPlanId = transaction.planId;
      const capturedAmount = Number(transaction.amount);
      
      const teacher = await db
        .selectFrom("users")
        .select(["displayName", "email"])
        .where("id", "=", capturedTeacherId)
        .executeTakeFirst();

      if (teacher?.email) {
        const plan = await db
          .selectFrom("subscriptionPlans")
          .select(["name"])
          .where("id", "=", capturedPlanId)
          .executeTakeFirst();

        if (plan) {
          const template = subscriptionPaymentFailed(
            teacher.displayName,
            plan.name,
            capturedAmount
          );
          await sendEmail({
            to: teacher.email as string,
            subject: template.subject,
            html: template.html,
            text: template.text,
          });
        }
      }
    } catch (emailError) {
      console.error("[mark-failed_POST] Failed to send subscription payment failed email:", emailError);
    }

    // 6. Return success response
    return new Response(
      superjson.stringify({
        success: true,
        message: `Transaction ${transactionId} has been marked as failed`,
        transaction: {
          id: transactionId,
          previousStatus: "pending",
          newStatus: "failed",
        },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[MarkSubscriptionTransactionFailed] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}