import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, InputType, OutputType } from "./create_POST.schema";
import { isTeacherSlotBookable } from "../../../helpers/mentorshipSlots";
import { followTeacher } from "../../../helpers/ensureTeacherFollow";
import { sendEmail } from "../../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import { MENTORSHIP_SESSION_DURATIONS, MENTORSHIP_RATE_UNIT_MINUTES, MENTORSHIP_MIN_RATE_PER_UNIT } from "../../../helpers/liveLessonConfig";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students can book 1:1 sessions." }), { status: 403 });
    }

    const json = superjson.parse<InputType>(await request.text());
    const { teacherId, durationMinutes, startTime, paymentOrderId, studentNotes } = schema.parse(json);

    if (!(MENTORSHIP_SESSION_DURATIONS as readonly number[]).includes(durationMinutes)) {
      throw new Error("Unsupported session duration.");
    }

    // Re-validate outside the lock too: cheap early rejection before we take the advisory lock.
    const teacher = await db
      .selectFrom("users")
      .select(["id", "role", "mentorshipEnabled", "mentorshipRatePerUnit", "displayName", "email"])
      .where("id", "=", teacherId)
      .executeTakeFirst();
    const rate = Number(teacher?.mentorshipRatePerUnit ?? 0);
    if (!teacher || teacher.role !== "teacher" || !teacher.mentorshipEnabled || rate < MENTORSHIP_MIN_RATE_PER_UNIT) {
      throw new Error("This teacher does not currently offer 1:1 sessions.");
    }
    const priceNumber = Math.round((rate * durationMinutes) / MENTORSHIP_RATE_UNIT_MINUTES);

    const result = await db.transaction().execute(async (trx) => {
      // Serialize every booking attempt for this teacher so two concurrent requests can't both pass
      // the overlap check before either has written its row. Released automatically at commit/rollback.
      await sql`select pg_advisory_xact_lock(hashtext(${"mentorship_booking_teacher_" + teacherId}))`.execute(trx);

      const bookable = await isTeacherSlotBookable(teacherId, startTime, durationMinutes, trx);
      if (!bookable.ok) {
        throw new Error(bookable.reason);
      }

      const isPaidBooking = !!paymentOrderId;

      if (priceNumber > 0 && !isPaidBooking) {
        throw new Error("This is a paid session. Please complete payment first.");
      }
      if (priceNumber === 0 && isPaidBooking) {
        throw new Error("This session is free and does not require payment.");
      }

      let amountPaid = 0;
      if (isPaidBooking) {
        const order = await trx.selectFrom("orders").selectAll().where("id", "=", paymentOrderId!).executeTakeFirst();
        if (!order) throw new Error("Payment order not found.");
        if (order.userId !== user.id) throw new Error("This payment order does not belong to you.");
        if (order.status !== "completed") throw new Error("Payment has not been completed yet.");
        if (!order.paymentTransactionId) throw new Error("Invalid payment order.");

        const expectedPrefix = `mentorship-${teacherId}-${durationMinutes}-`;
        if (!order.paymentTransactionId.startsWith(expectedPrefix)) {
          throw new Error("This payment order is not for this session.");
        }

        const alreadyUsed = await trx
          .selectFrom("orderItems")
          .select("id")
          .where("orderId", "=", paymentOrderId!)
          .where("mentorshipBookingId", "is not", null)
          .executeTakeFirst();
        if (alreadyUsed) {
          throw new Error("This payment has already been used for a booking.");
        }

        amountPaid = Number(order.totalAmount);
      }

      // A student's first (non-cancelled) booking with this teacher is a trial, Preply-style.
      const priorBooking = await trx
        .selectFrom("mentorshipBookings")
        .select("id")
        .where("teacherId", "=", teacherId)
        .where("studentId", "=", user.id)
        .where("status", "!=", "cancelled")
        .executeTakeFirst();
      const isTrial = !priorBooking;

      const inserted = await trx
        .insertInto("mentorshipBookings")
        .values({
          teacherId,
          studentId: user.id,
          scheduledAt: startTime,
          durationMinutes,
          amountPaid: amountPaid.toFixed(2),
          orderId: paymentOrderId ?? null,
          studentNotes: studentNotes ?? null,
          status: "scheduled",
          isTrial,
        })
        .returning(["id", "status", "scheduledAt", "isTrial"])
        .executeTakeFirstOrThrow();

      if (paymentOrderId) {
        await trx
          .updateTable("orderItems")
          .set({ mentorshipBookingId: inserted.id })
          .where("orderId", "=", paymentOrderId)
          .where("mentorshipTeacherId", "=", teacherId)
          .execute();
      }

      await followTeacher(trx, user.id, teacherId);

      return inserted;
    });

    try {
      const student = await db.selectFrom("users").select(["email", "displayName"]).where("id", "=", user.id).executeTakeFirst();
      const sessionLabel = `${result.isTrial ? "Trial " : ""}1:1 session (${durationMinutes} min)`;
      if (student?.email) {
        const tmpl = emailTemplatesExtra.mentorshipBookingConfirmed(
          student.displayName,
          teacher.displayName ?? "your teacher",
          sessionLabel,
          result.scheduledAt,
          durationMinutes,
          result.id
        );
        await sendEmail({ to: student.email, ...tmpl });
      }
      if (teacher.email) {
        const tmpl = emailTemplatesExtra.newPurchaseNotification(
          teacher.displayName,
          student?.displayName ?? "A student",
          sessionLabel,
          "1:1 session",
          priceNumber
        );
        await sendEmail({ to: teacher.email, ...tmpl });
      }
    } catch (emailError) {
      console.error("Failed to send mentorship booking emails:", emailError);
    }

    const output: OutputType = {
      bookingId: result.id,
      status: result.status ?? "scheduled",
      scheduledAt: result.scheduledAt,
      isTrial: !!result.isTrial,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to create mentorship booking:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
