import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { schema, OutputType } from "./cancel_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../../helpers/getSetServerSession";
import { sendEmail } from "../../../../helpers/sendEmail";
import { mandateCancelled } from "../../../../helpers/emailTemplates";
import { revokeMandate } from "../../../../helpers/payuSIApi";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { subscriptionId } = schema.parse(json);

    const subscription = await db
      .selectFrom("teacherSubscriptions")
      .where("id", "=", subscriptionId)
      .where("teacherId", "=", effectiveTeacherId)
      .select(["id", "mandateId", "mandateStatus", "mandatePaymentMode", "planId"])
      .executeTakeFirst();

    if (!subscription) {
      throw new Error("Subscription not found or you do not have permission to modify it.");
    }
    if (!subscription.mandateId || subscription.mandateStatus !== "active") {
      throw new Error("No active mandate found to cancel for this subscription.");
    }

    const cancelResponse = await revokeMandate(subscription.mandateId, subscription.mandatePaymentMode);

    if (cancelResponse.success) {
      await db
        .updateTable("teacherSubscriptions")
        .set({
          mandateStatus: "cancelled",
          autoRenew: false,
        })
        .where("id", "=", subscription.id)
        .execute();

      const planId = subscription.planId;
      const teacherEmail = user.email;
      const teacherName = user.displayName;
      try {
        const plan = await db.selectFrom("subscriptionPlans")
          .select(["name"])
          .where("id", "=", planId)
          .executeTakeFirst();
        
        if (plan && teacherEmail) {
          const template = mandateCancelled(teacherName, plan.name);
          await sendEmail({
            to: teacherEmail,
            subject: template.subject,
            html: template.html,
            text: template.text,
          });
        }
      } catch (err) {
        console.error("[mandate/cancel_POST] Failed to send mandate cancelled email:", err);
      }

      return new Response(
        superjson.stringify({
          success: true,
          message: "Mandate cancelled successfully. Your subscription will not auto-renew.",
        } satisfies OutputType)
      );
    } else {
      throw new Error(`Failed to cancel mandate with payment provider: ${cancelResponse.message}`);
    }
  } catch (error) {
    console.error("Failed to cancel mandate:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 401,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to cancel mandate.",
        details: errorMessage,
      }),
      { status: 400 }
    );
  }
}