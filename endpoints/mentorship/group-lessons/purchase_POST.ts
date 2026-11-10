import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, InputType, OutputType } from "./purchase_POST.schema";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../../helpers/getTeacherPlatformFee";
import { getOrderClientInfo } from "../../../helpers/orderClientInfo";
import { getOrderAttribution } from "../../../helpers/getOrderAttribution";
import { recordFunnelEvent } from "../../../helpers/recordFunnelEvent";
import { openCashfreeSession } from "../../../helpers/cashfreeOrders";
import { getCashfreeConfig } from "../../../helpers/cashfree";
import { groupLessonPath } from "../../../helpers/groupLessonRoutes";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      throw new NotAuthenticatedError("Only students can enroll in group lessons.");
    }

    const json = superjson.parse<InputType>(await request.text());
    const { groupLessonId } = schema.parse(json);

    // Fail before any order exists if the gateway is not set up.
    getCashfreeConfig();

    const cashfreeOrderId = `group-lesson-${groupLessonId}-${nanoid(12)}`;

    const created = await db.transaction().execute(async (trx) => {
      const lesson = await trx.selectFrom("groupLessons").selectAll().where("id", "=", groupLessonId).executeTakeFirst();
      if (!lesson) throw new Error("Group lesson not found.");
      if (lesson.status !== "scheduled") throw new Error("This group lesson is no longer open.");
      if (lesson.startTime < new Date()) throw new Error("This group lesson has already started.");
      if (lesson.enrolledCount >= lesson.maxCapacity) throw new Error("This group lesson is full.");
      if (Number(lesson.pricePerLearner) <= 0) throw new Error("This group lesson is free. Use the enroll endpoint directly.");

      const existing = await trx
        .selectFrom("groupLessonEnrollments")
        .select("id")
        .where("groupLessonId", "=", groupLessonId)
        .where("studentId", "=", user.id)
        .where("status", "=", "enrolled")
        .executeTakeFirst();
      if (existing) throw new Error("You are already enrolled in this group lesson.");

      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("userId", "=", user.id)
        .where("status", "=", "pending")
        .where("paymentTransactionId", "like", `group-lesson-${groupLessonId}-%`)
        .execute();

      const amount = Number(lesson.pricePerLearner).toFixed(2);

      const newOrder = await trx
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

      const platformFeePercentage = await getTeacherPlatformFee(lesson.teacherId, trx);

      await trx
        .insertInto("orderItems")
        .values({
          orderId: newOrder.id,
          // Recorded so ensureOrderCompletionSideEffects creates the enrollment once the
          // payment is confirmed, whether that is the student's return or the webhook.
          groupLessonId,
          priceAtPurchase: amount,
          platformFeePercentage: (platformFeePercentage ?? DEFAULT_TEACHER_PLATFORM_FEE).toFixed(2),
        })
        .execute();

      return { orderId: newOrder.id, amount, title: lesson.title };
    });

    const session: OutputType = await openCashfreeSession({
      orderId: created.orderId,
      cashfreeOrderId,
      amount: Number(created.amount),
      user,
      returnPath: groupLessonPath(groupLessonId),
      note: created.title.substring(0, 100),
    });

    await recordFunnelEvent({
      event: "checkout_started",
      request,
      userId: user.id,
      orderId: created.orderId,
      entityType: "group_lesson",
      amount: created.amount,
      props: { path: "group_lesson", gateway: "cashfree", groupLessonId },
    });

    return new Response(superjson.stringify(session));
  } catch (error) {
    console.error("Failed to initiate group lesson purchase:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to initiate payment.", details: errorMessage }), { status: 400 });
  }
}
