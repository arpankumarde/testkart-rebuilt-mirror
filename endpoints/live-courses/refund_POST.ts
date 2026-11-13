import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { LiveCourseError, errorResponse, refundLiveCourseEnrollment } from "../../helpers/liveCourseServer";
import { sendRefundNotices } from "../../helpers/liveCourseNotices";
import { schema, type OutputType } from "./refund_POST.schema";

/** The money-back guarantee: a full refund on request until the course's 3rd class starts. */
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") throw new LiveCourseError("Only the enrolled student can ask for this refund.", 403);
    const { liveCourseId } = schema.parse(superjson.parse(await request.text()));

    const enrollment = await db
      .selectFrom("liveCourseEnrollments")
      .select("id")
      .where("liveCourseId", "=", liveCourseId)
      .where("studentId", "=", user.id)
      .where("status", "=", "enrolled")
      .executeTakeFirst();
    if (!enrollment) throw new LiveCourseError("You are not enrolled in this live course.", 404);

    const outcome = await refundLiveCourseEnrollment({ enrollmentId: enrollment.id, by: "student" });
    await sendRefundNotices(liveCourseId, user.id, outcome.amount);

    const output: OutputType = { amount: outcome.amount, refundStatus: outcome.refundStatus };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Live course refund failed:", error);
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
