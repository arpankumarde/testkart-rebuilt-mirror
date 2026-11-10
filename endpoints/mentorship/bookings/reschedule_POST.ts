import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./reschedule_POST.schema";
import { isTeacherSlotBookable } from "../../../helpers/mentorshipSlots";
import { sendEmail } from "../../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import { isLateForStudent, isStudentFree } from "../../../helpers/livePackages";
import { FREE_CANCELLATION_CUTOFF_HOURS } from "../../../helpers/liveLessonConfig";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

const booking = await db
      .selectFrom("mentorshipBookings")
      .innerJoin("users as student", "student.id", "mentorshipBookings.studentId")
      .innerJoin("users as teacher", "teacher.id", "mentorshipBookings.teacherId")
      .select([
        "mentorshipBookings.id",
        "mentorshipBookings.studentId",
        "mentorshipBookings.teacherId",
        "mentorshipBookings.status",
        "mentorshipBookings.durationMinutes",
        "mentorshipBookings.amountPaid",
        "mentorshipBookings.orderId",
        "mentorshipBookings.studentNotes",
        "mentorshipBookings.isTrial",
        "mentorshipBookings.scheduledAt",
        "mentorshipBookings.creditId",
        "mentorshipBookings.packageId",
        "student.email as studentEmail",
        "student.displayName as studentName",
        "teacher.email as teacherEmail",
        "teacher.displayName as teacherName",
      ])
      .where("mentorshipBookings.id", "=", input.bookingId)
      .executeTakeFirst();

    if (!booking) {
      return new Response(superjson.stringify({ error: "Booking not found" }), { status: 404 });
    }

    const isStudent = user.role === "student" && booking.studentId === user.id;
    const isTeacher = user.role === "teacher" && booking.teacherId === effectiveTeacherId;
    const isAdmin = user.role === "admin";
    if (!isStudent && !isTeacher && !isAdmin) {
      return new Response(superjson.stringify({ error: "You cannot reschedule this booking." }), { status: 403 });
    }

    if (booking.status !== "scheduled") {
      return new Response(superjson.stringify({ error: `A ${booking.status} booking cannot be rescheduled.` }), { status: 400 });
    }
    if (isStudent && isLateForStudent(new Date(booking.scheduledAt))) {
      return new Response(
        superjson.stringify({ error: `Classes can be moved up to ${FREE_CANCELLATION_CUTOFF_HOURS} hours before they start.` }),
        { status: 400 }
      );
    }

    const result = await db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(hashtext(${"mentorship_booking_teacher_" + booking.teacherId}))`.execute(trx);

      const bookable = await isTeacherSlotBookable(booking.teacherId, input.newStartTime, booking.durationMinutes, trx);
      if (!bookable.ok) throw new Error(bookable.reason);
      if (!(await isStudentFree(trx, booking.studentId, input.newStartTime, booking.durationMinutes, booking.id))) {
        throw new Error("The student already has a class at this time.");
      }

      await trx
        .updateTable("mentorshipBookings")
        .set({
          status: "cancelled",
          cancellationReason: "Rescheduled to a new time",
          cancelledAt: new Date(),
          cancelledBy: isAdmin ? "admin" : isTeacher ? "teacher" : "student",
          ...(booking.creditId ? { earningStatus: "void" as const } : {}),
          updatedAt: new Date(),
        })
        .where("id", "=", booking.id)
        .execute();

      const inserted = await trx
        .insertInto("mentorshipBookings")
        .values({
          teacherId: booking.teacherId,
          studentId: booking.studentId,
          scheduledAt: input.newStartTime,
          durationMinutes: booking.durationMinutes,
          amountPaid: booking.amountPaid,
          orderId: booking.orderId,
          studentNotes: booking.studentNotes,
          rescheduledFromBookingId: booking.id,
          status: "scheduled",
          isTrial: booking.isTrial,
          creditId: booking.creditId,
          packageId: booking.packageId,
        })
        .returning(["id", "scheduledAt"])
        .executeTakeFirstOrThrow();

      if (booking.creditId) {
        await trx
          .updateTable("liveClassCredits")
          .set({ bookingId: inserted.id, updatedAt: new Date() })
          .where("id", "=", booking.creditId)
          .execute();
      }

      return inserted;
    });

    const sessionLabel = `${booking.isTrial ? "Trial " : ""}1:1 session (${booking.durationMinutes} min)`;
    try {
      if (booking.studentEmail) {
        const tmpl = emailTemplatesExtra.mentorshipBookingRescheduled(
          booking.studentName,
          booking.teacherName,
          sessionLabel,
          result.scheduledAt,
          true,
          result.id
        );
        await sendEmail({ to: booking.studentEmail, ...tmpl });
      }
      if (booking.teacherEmail) {
        const tmpl = emailTemplatesExtra.mentorshipBookingRescheduled(
          booking.teacherName,
          booking.studentName,
          sessionLabel,
          result.scheduledAt,
          false,
          result.id
        );
        await sendEmail({ to: booking.teacherEmail, ...tmpl });
      }
    } catch (emailError) {
      console.error("Failed to send mentorship reschedule emails:", emailError);
    }

    const output: OutputType = { newBookingId: result.id, scheduledAt: result.scheduledAt };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to reschedule mentorship booking:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
