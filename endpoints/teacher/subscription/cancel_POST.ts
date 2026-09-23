import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./cancel_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { sendEmail } from "../../../helpers/sendEmail";
import { subscriptionCancelled } from "../../../helpers/emailTemplates";
import { stopTeacherRenewal } from "../../../helpers/teacherMandate";

// Cancelling stops renewal and revokes the PayU mandate; the paid plan stays
// active until its end date (see helpers/teacherMandate).
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

    const stopped = await stopTeacherRenewal(effectiveTeacherId);
    if (!stopped) {
      throw new Error("No active paid subscription found to cancel.");
    }

    const updatedSubscription = await db
      .selectFrom("teacherSubscriptions")
      .selectAll()
      .where("id", "=", stopped.subscriptionId)
      .executeTakeFirstOrThrow();

    if (stopped.endDate && user.email) {
      try {
        const template = subscriptionCancelled(user.displayName, stopped.planName, new Date(stopped.endDate));
        await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
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