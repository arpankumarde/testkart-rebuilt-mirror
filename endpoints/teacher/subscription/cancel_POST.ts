import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./cancel_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { sendEmail } from "../../../helpers/sendEmail";
import { subscriptionCancelled } from "../../../helpers/emailTemplates";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const [updatedSubscription] = await db
      .updateTable("teacherSubscriptions")
      .set({
        status: "cancelled",
        autoRenew: false,
        updatedAt: new Date(),
      })
      .where("teacherId", "=", effectiveTeacherId)
      .where("status", "=", "active")
      .returningAll()
      .execute();

    if (!updatedSubscription) {
      throw new Error(
        "No active subscription found to cancel or already cancelled."
      );
    }

    // Revoke verification when subscription is cancelled
    await db
      .updateTable("users")
      .set({ isVerified: false })
      .where("id", "=", effectiveTeacherId)
      .execute();

    if (updatedSubscription.endDate) {
      try {
        const plan = await db.selectFrom("subscriptionPlans")
          .select(["name"])
          .where("id", "=", updatedSubscription.planId)
          .executeTakeFirst();
        
        if (plan && user.email) {
          const template = subscriptionCancelled(
            user.displayName,
            plan.name,
            updatedSubscription.endDate as Date
          );
          await sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
          });
        }
      } catch (err) {
        console.error("[cancel_POST] Failed to send cancellation email:", err);
      }
    }

    return new Response(
      superjson.stringify(updatedSubscription satisfies OutputType)
    );
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 401,
      });
    }
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}