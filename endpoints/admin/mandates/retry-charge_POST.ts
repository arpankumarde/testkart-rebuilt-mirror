import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./retry-charge_POST.schema";
import superjson from "superjson";
import { sendEmail } from "../../../helpers/sendEmail";
import { subscriptionRenewed } from "../../../helpers/emailTemplates";
import { executeSITransaction } from "../../../helpers/payuSIApi";
import { extractPayUFailure } from "../../../helpers/extractPayUFailure";
import { CHARGE_TXNID_PATTERNS, newChargeTxnid } from "../../../helpers/teacherMandate";
import { effectiveRenewalAmount } from "../../../helpers/subscriptionPromoCodes";

/**
 * Admin-triggered equivalent of endpoints/payment/payu/recurring/charge-mandate_POST.ts.
 * Skips the "is it actually due yet / has the pre-debit notice matured" eligibility
 * checks that gate the teacher-facing and scheduled renewal paths, since an admin
 * manually forcing a stuck or failed mandate through is exactly the point of this
 * control - but still refuses an inactive subscription, an inactive mandate, or a
 * charge that's already in flight.
 */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const { subscriptionId } = schema.parse(superjson.parse(await request.text()));

    const result = await db.transaction().execute(async (trx) => {
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
        .select([
          "teacherSubscriptions.id",
          "teacherSubscriptions.teacherId",
          "teacherSubscriptions.planId",
          "teacherSubscriptions.status",
          "teacherSubscriptions.mandateId",
          "teacherSubscriptions.mandateStatus",
          "teacherSubscriptions.endDate",
          "teacherSubscriptions.promoDuration",
          "teacherSubscriptions.promoDiscountAmount",
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
      if (!subscription.mandateId) {
        throw new Error("This subscription has no mandate to charge.");
      }
      if (subscription.mandateStatus !== "active") {
        throw new Error(`The mandate is not active (status: ${subscription.mandateStatus ?? "unknown"}).`);
      }
      if (subscription.status !== "active") {
        throw new Error("The subscription itself is not active.");
      }

      const pendingCharge = await trx
        .selectFrom("subscriptionTransactions")
        .select("id")
        .where("subscriptionId", "=", subscription.id)
        .where("status", "=", "pending")
        .where((eb) => eb.or(CHARGE_TXNID_PATTERNS.map((pattern) => eb("transactionId", "like", pattern))))
        .executeTakeFirst();
      if (pendingCharge) {
        throw new Error("A charge for this mandate is already in progress.");
      }

      const teacherEmail = subscription.email;
      if (!teacherEmail) {
        throw new Error("Teacher has no email on file; cannot proceed.");
      }

      const txnid = newChargeTxnid();
      const chargeAmount = effectiveRenewalAmount(subscription);
      await trx
        .insertInto("subscriptionTransactions")
        .values({
          teacherId: subscription.teacherId,
          planId: subscription.planId,
          subscriptionId: subscription.id,
          amount: String(chargeAmount),
          status: "pending",
          paymentMethod: "payu_recurring",
          transactionId: txnid,
          notes: "Admin-triggered manual charge",
        })
        .execute();

      const chargeResponse = await executeSITransaction({
        authPayuId: subscription.mandateId,
        txnid,
        amount: chargeAmount.toFixed(2),
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

        await trx
          .updateTable("users")
          .set({ isVerified: true })
          .where("id", "=", subscription.teacherId)
          .execute();

        return {
          success: true,
          message: "Charged successfully.",
          chargeStatus: "captured" as const,
          teacherEmail,
          teacherDisplayName: subscription.displayName,
          planName: subscription.planName,
          amountNumber: chargeAmount,
          newEndDate,
        };
      } else if (chargeResponse.status === "pending") {
        return {
          success: true,
          message: "The charge was submitted and is being processed by PayU.",
          chargeStatus: "pending" as const,
          teacherEmail: null,
          teacherDisplayName: "",
          planName: "",
          amountNumber: chargeAmount,
          newEndDate: null,
        };
      } else {
        await trx
          .updateTable("subscriptionTransactions")
          .set({
            status: "failed",
            notes: chargeResponse.message,
            ...extractPayUFailure({ status: "failure", error_Message: chargeResponse.message }),
          })
          .where("transactionId", "=", txnid)
          .execute();

        throw new Error(`PayU declined the charge: ${chargeResponse.message}`);
      }
    });

    if (result.chargeStatus === "captured" && result.teacherEmail && result.newEndDate) {
      await sendEmail({
        to: result.teacherEmail,
        ...subscriptionRenewed(result.teacherDisplayName, result.planName, result.amountNumber, result.newEndDate),
      }).catch((err) => console.error("[admin/mandates/retry-charge] Failed to send renewal email:", err));
    }

    return new Response(
      superjson.stringify({
        success: result.success,
        message: result.message,
        chargeStatus: result.chargeStatus,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/mandates/retry-charge] Failed:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to charge mandate." }),
      { status: 400 }
    );
  }
}
