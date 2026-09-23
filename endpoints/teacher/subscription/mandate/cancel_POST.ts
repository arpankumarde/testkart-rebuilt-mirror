import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { schema, OutputType } from "./cancel_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../../helpers/getSetServerSession";
import { sendEmail } from "../../../../helpers/sendEmail";
import { subscriptionCancelled } from "../../../../helpers/emailTemplates";
import { stopTeacherRenewal } from "../../../../helpers/teacherMandate";

// Same cancel as teacher/subscription/cancel, for one subscription id.
export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { subscriptionId } = schema.parse(json);

    const stopped = await stopTeacherRenewal(effectiveTeacherId, subscriptionId);
    if (!stopped) {
      throw new Error("Subscription not found or you do not have permission to modify it.");
    }

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
        console.error("[mandate/cancel_POST] Failed to send cancellation email:", err);
      }
    }

    return new Response(
      superjson.stringify({
        success: true,
        message: "Autopay cancelled. Your plan stays active until its end date and will not renew.",
      } satisfies OutputType)
    );
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