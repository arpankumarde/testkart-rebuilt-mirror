import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./enroll_POST.schema";
import { followTeacher } from "../../../helpers/ensureTeacherFollow";
import { sendEmail } from "../../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students can enroll in group lessons." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { groupLessonId, paymentOrderId } = schema.parse(json);

    const result = await db.transaction().execute(async (trx) => {
      const lesson = await trx
        .selectFrom("groupLessons")
        .selectAll()
        .where("id", "=", groupLessonId)
        .forUpdate()
        .executeTakeFirst();

      if (!lesson || lesson.liveCourseId) throw new Error("Group lesson not found.");
      // Standalone group lessons were retired for live courses on 18-11-2026; only a paid order already in hand completes.
      if (!paymentOrderId) throw new Error("Group lessons are no longer open. Look for a live course instead.");
      if (lesson.status !== "scheduled") throw new Error("This group lesson is no longer open for enrollment.");
      if (lesson.startTime < new Date()) throw new Error("This group lesson has already started.");

      const isFree = Number(lesson.pricePerLearner) === 0;
      const isPaidEnrollment = !!paymentOrderId;
      if (isFree && isPaidEnrollment) throw new Error("This group lesson is free and does not require payment.");
      if (!isFree && !isPaidEnrollment) throw new Error("This is a paid group lesson. Please complete payment first.");

      let amountPaid = 0;
      if (isPaidEnrollment) {
        const order = await trx.selectFrom("orders").selectAll().where("id", "=", paymentOrderId!).executeTakeFirst();
        if (!order) throw new Error("Payment order not found.");
        if (order.userId !== user.id) throw new Error("This payment order does not belong to you.");
        if (order.status !== "completed") throw new Error("Payment has not been completed yet.");
        if (!order.paymentTransactionId) throw new Error("Invalid payment order.");

        const expectedPrefix = `group-lesson-${groupLessonId}-`;
        if (!order.paymentTransactionId.startsWith(expectedPrefix)) {
          throw new Error("This payment order is not for this group lesson.");
        }

        const alreadyUsed = await trx
          .selectFrom("groupLessonEnrollments")
          .select("id")
          .where("orderId", "=", paymentOrderId!)
          .executeTakeFirst();
        if (alreadyUsed) throw new Error("This payment has already been used for an enrollment.");

        amountPaid = Number(order.totalAmount);
      }

      if (lesson.enrolledCount >= lesson.maxCapacity) {
        throw new Error("This group lesson is full.");
      }

      const existingEnrollment = await trx
        .selectFrom("groupLessonEnrollments")
        .select(["id", "status"])
        .where("groupLessonId", "=", groupLessonId)
        .where("studentId", "=", user.id)
        .executeTakeFirst();

      if (existingEnrollment?.status === "enrolled") {
        throw new Error("You are already enrolled in this group lesson.");
      }

      if (existingEnrollment) {
        // Re-enrolling after a prior cancellation/removal: reuse the row rather than violate the
        // (groupLessonId, studentId) uniqueness constraint.
        await trx
          .updateTable("groupLessonEnrollments")
          .set({ status: "enrolled", orderId: paymentOrderId ?? null, amountPaid: amountPaid.toFixed(2), removedByTeacher: false, cancelledAt: null, enrolledAt: new Date() })
          .where("id", "=", existingEnrollment.id)
          .execute();
      } else {
        await trx
          .insertInto("groupLessonEnrollments")
          .values({
            groupLessonId,
            studentId: user.id,
            orderId: paymentOrderId ?? null,
            amountPaid: amountPaid.toFixed(2),
            status: "enrolled",
          })
          .returning("id")
          .executeTakeFirstOrThrow();
      }

      await trx.updateTable("groupLessons").set({ enrolledCount: lesson.enrolledCount + 1 }).where("id", "=", groupLessonId).execute();

      await followTeacher(trx, user.id, lesson.teacherId);

      const refreshed = await trx
        .selectFrom("groupLessonEnrollments")
        .select("id")
        .where("groupLessonId", "=", groupLessonId)
        .where("studentId", "=", user.id)
        .executeTakeFirstOrThrow();

      return { enrollmentId: refreshed.id, lesson };
    });

    try {
      const [student, teacher] = await Promise.all([
        db.selectFrom("students").select(["email", "displayName"]).where("id", "=", user.id).executeTakeFirst(),
        db.selectFrom("teachers").select(["displayName"]).where("id", "=", result.lesson.teacherId).executeTakeFirst(),
      ]);
      if (student?.email) {
        const tmpl = emailTemplatesExtra.groupLessonEnrolled(
          student.displayName,
          teacher?.displayName ?? "the teacher",
          result.lesson.title,
          result.lesson.startTime,
          groupLessonId
        );
        await sendEmail({ to: student.email, ...tmpl });
      }
    } catch (emailError) {
      console.error("Failed to send group lesson enrollment email:", emailError);
    }

    const output: OutputType = { enrollmentId: result.enrollmentId };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to enroll in group lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
