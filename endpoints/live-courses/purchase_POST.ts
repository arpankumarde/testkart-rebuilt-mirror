import superjson from "superjson";
import { nanoid } from "nanoid";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../helpers/getTeacherPlatformFee";
import { getOrderClientInfo } from "../../helpers/orderClientInfo";
import { getOrderAttribution } from "../../helpers/getOrderAttribution";
import { recordFunnelEvent } from "../../helpers/recordFunnelEvent";
import { openCashfreeSession } from "../../helpers/cashfreeOrders";
import { getCashfreeConfig } from "../../helpers/cashfree";
import { liveCoursePath } from "../../helpers/liveCourseRules";
import { schema, type OutputType } from "./purchase_POST.schema";

/** Buy now through Cashfree. Live courses take no Tcoins and no promo codes; the order is the full price. */
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") throw new NotAuthenticatedError("Only students can enrol in live courses.");
    const { liveCourseId } = schema.parse(superjson.parse(await request.text()));

    getCashfreeConfig();
    const cashfreeOrderId = `live-course-${liveCourseId}-${nanoid(12)}`;

    const created = await db.transaction().execute(async (trx) => {
      const course = await trx.selectFrom("liveCourses").selectAll().where("id", "=", liveCourseId).executeTakeFirst();
      if (!course || course.status !== "published") throw new Error("This live course is not open for enrolment.");
      if (course.registrationDeadline && new Date(course.registrationDeadline).getTime() <= Date.now()) {
        throw new Error("Registration for this live course has closed.");
      }
      if (course.enrolledCount >= course.seatLimit) throw new Error("This live course is full.");
      if (Number(course.price) <= 0) throw new Error("This live course has no price set.");
      const upcoming = await trx
        .selectFrom("groupLessons")
        .select("id")
        .where("liveCourseId", "=", course.id)
        .where("status", "=", "scheduled")
        .where("startTime", ">", new Date())
        .executeTakeFirst();
      if (!upcoming) throw new Error("This live course has no classes left.");

      const existing = await trx
        .selectFrom("liveCourseEnrollments")
        .select("id")
        .where("liveCourseId", "=", course.id)
        .where("studentId", "=", user.id)
        .where("status", "=", "enrolled")
        .executeTakeFirst();
      if (existing) throw new Error("You are already enrolled in this live course.");

      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("userId", "=", user.id)
        .where("status", "=", "pending")
        .where("paymentTransactionId", "like", `live-course-${course.id}-%`)
        .execute();

      const amount = Number(course.price).toFixed(2);
      const order = await trx
        .insertInto("orders")
        .values({
          userId: user.id,
          ...getOrderClientInfo(request),
          ...getOrderAttribution(request),
          totalAmount: amount,
          status: "pending",
          paymentMethod: "cashfree",
          paymentTransactionId: cashfreeOrderId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const fee = await getTeacherPlatformFee(course.teacherId, trx);
      await trx
        .insertInto("orderItems")
        .values({
          orderId: order.id,
          liveCourseId: course.id,
          priceAtPurchase: amount,
          platformFeePercentage: (fee ?? DEFAULT_TEACHER_PLATFORM_FEE).toFixed(2),
        })
        .execute();

      return { orderId: order.id, amount, title: course.title, slug: course.slug };
    });

    const session: OutputType = await openCashfreeSession({
      orderId: created.orderId,
      cashfreeOrderId,
      amount: Number(created.amount),
      user,
      returnPath: liveCoursePath(created.slug),
      note: created.title.substring(0, 100),
    });

    await recordFunnelEvent({
      event: "checkout_started",
      request,
      userId: user.id,
      orderId: created.orderId,
      entityType: "live_course",
      amount: created.amount,
      props: { path: "live_course", gateway: "cashfree", liveCourseId },
    });

    return new Response(superjson.stringify(session));
  } catch (error) {
    console.error("Failed to start live course purchase:", error);
    const status = error instanceof NotAuthenticatedError ? 401 : 400;
    const details = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to start the payment.", details }), { status });
  }
}
