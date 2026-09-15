import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../../helpers/getSetServerSession";
import { getMandateChargeRefusal } from "../../../../helpers/mandateChargeEligibility";
import { schema, OutputType } from "./charge-mandate_POST.schema";
import superjson from "superjson";
import { sendEmail } from "../../../../helpers/sendEmail";
import { subscriptionRenewed } from "../../../../helpers/emailTemplates";
import { executeSITransaction } from "../../../../helpers/payuSIApi";
import { extractPayUFailure } from "../../../../helpers/extractPayUFailure";
import { randomUUID } from "crypto";

export async function handle(request: Request) {
  try {
    // Triggered only from the owner's own browser (AutoRenewalChecker and the
    // subscription page). Scheduled renewals run in helpers/subscriptionRenew.
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher" || teacherRole !== "owner") {
      return new Response(
        superjson.stringify({ error: "Only account owners can renew a subscription." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { subscriptionId } = schema.parse(json);

    const paymentMode = await db
      .selectFrom("platformSettings")
      .select("settingValue")
      .where("settingKey", "=", "subscription_payment_mode")
      .executeTakeFirst();
    if (paymentMode?.settingValue !== "recurring") {
      throw new Error("Recurring payments are not enabled.");
    }

    const result = await db.transaction().execute(async (trx) => {
      // Serialises concurrent triggers for the same subscription, e.g. two open tabs.
      await trx
        .selectFrom("teacherSubscriptions")
        .select("id")
        .where("id", "=", subscriptionId)
        .forUpdate()
        .executeTakeFirst();

      const subscription = await trx
        .selectFrom("teacherSubscriptions")
        .innerJoin("subscriptionPlans", "teacherSubscriptions.planId", "subscriptionPlans.id")
        .innerJoin("users", "teacherSubscriptions.teacherId", "users.id")
        .where("teacherSubscriptions.id", "=", subscriptionId)
        .where("teacherSubscriptions.teacherId", "=", effectiveTeacherId)
        .select([
          "teacherSubscriptions.id",
          "teacherSubscriptions.teacherId",
          "teacherSubscriptions.planId",
          "teacherSubscriptions.status",
          "teacherSubscriptions.autoRenew",
          "teacherSubscriptions.endDate",
          "teacherSubscriptions.mandateId",
          "teacherSubscriptions.mandateStatus",
          "teacherSubscriptions.nextChargeDate",
          "teacherSubscriptions.preDebitSentAt",
          "subscriptionPlans.durationDays",
          "subscriptionPlans.price",
          "subscriptionPlans.name as planName",
          "users.email",
          "users.displayName",
          "users.mobileNumber",
        ])
        .executeTakeFirst();

      if (!subscription) {
        throw new Error("Subscription not found.");
      }
      const refusal = getMandateChargeRefusal(subscription);
      if (refusal) {
        throw new Error(refusal);
      }

      const pendingCharge = await trx
        .selectFrom("subscriptionTransactions")
        .select("id")
        .where("subscriptionId", "=", subscription.id)
        .where("status", "=", "pending")
        .where("transactionId", "like", "testkart-charge-%")
        .executeTakeFirst();
      if (pendingCharge) {
        throw new Error("A renewal payment for this subscription is already being processed.");
      }

      const teacherEmail = subscription.email;
      if (!teacherEmail) {
        throw new Error("Teacher email not found. Cannot proceed with charge.");
      }

      const txnid = `testkart-charge-${randomUUID()}`;
      await trx
        .insertInto("subscriptionTransactions")
        .values({
          teacherId: subscription.teacherId,
          planId: subscription.planId,
          subscriptionId: subscription.id,
          amount: subscription.price,
          status: "pending",
          paymentMethod: "payu_recurring",
          transactionId: txnid,
        })
        .execute();

      // PayU SI transaction API call. It runs inside this transaction, so the
      // row lock above is held until PayU answers.
      const chargeResponse = await executeSITransaction({
        authPayuId: subscription.mandateId!,
        txnid,
        amount: parseFloat(subscription.price).toFixed(2),
        email: teacherEmail,
        phone: subscription.mobileNumber || "0000000000",
        firstname: subscription.displayName,
      });

      if (chargeResponse.status === "captured") {
        const currentEndDate = new Date(subscription.endDate!);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(currentEndDate.getDate() + subscription.durationDays);

        await trx
          .updateTable("teacherSubscriptions")
          .set({
            endDate: newEndDate,
            lastChargeDate: new Date(),
            nextChargeDate: newEndDate,
            status: "active",
            preDebitSentAt: null,
          })
          .where("id", "=", subscription.id)
          .execute();

        await trx
          .updateTable("subscriptionTransactions")
          .set({ status: "completed" })
          .where("transactionId", "=", txnid)
          .execute();

        // Mark teacher as verified
        await trx
          .updateTable("users")
          .set({ isVerified: true })
          .where("id", "=", subscription.teacherId)
          .execute();

        return {
          success: true,
          message: "Subscription renewed successfully.",
          teacherEmail,
          teacherDisplayName: subscription.displayName,
          planName: subscription.planName,
          amountNumber: parseFloat(subscription.price),
          newEndDate,
          sendRenewalEmail: true,
        };
      } else if (chargeResponse.status === "pending") {
        // Leave transaction as pending; it will be verified later via verify_payment
        return {
          success: true,
          message: "Payment is being processed.",
          teacherEmail,
          teacherDisplayName: subscription.displayName,
          planName: subscription.planName,
          amountNumber: parseFloat(subscription.price),
          newEndDate: null,
          sendRenewalEmail: false,
        };
      } else {
        // failed
        await trx
          .updateTable("subscriptionTransactions")
          .set({
            status: "failed",
            notes: chargeResponse.message,
            ...extractPayUFailure({ status: "failure", error_Message: chargeResponse.message }),
          })
          .where("transactionId", "=", txnid)
          .execute();

        throw new Error(`Failed to charge mandate: ${chargeResponse.message}`);
      }
    });

    // Renewal success email (only for captured status)
    if (result.sendRenewalEmail && result.newEndDate) {
      await sendEmail({
        to: result.teacherEmail,
        ...subscriptionRenewed(result.teacherDisplayName, result.planName, result.amountNumber, result.newEndDate),
      }).catch(err => console.error("[Charge Mandate] Failed to send renewal email:", err));
    }

    return new Response(superjson.stringify({ success: result.success, message: result.message } satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Failed to charge mandate:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to process recurring payment.",
        details: errorMessage,
      }),
      { status: 400 }
    );
  }
}
