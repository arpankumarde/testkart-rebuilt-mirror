import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./cancel_POST.schema";
import { sendEmail } from "../../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import superjson from "superjson";

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
        "mentorshipBookings.scheduledAt",
        "mentorshipBookings.durationMinutes",
        "mentorshipBookings.isTrial",
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
      return new Response(superjson.stringify({ error: "You cannot cancel this booking." }), { status: 403 });
    }

    if (booking.status === "cancelled" || booking.status === "completed") {
      return new Response(superjson.stringify({ error: `This booking is already ${booking.status}.` }), { status: 400 });
    }

    const cancelledBy = isAdmin ? "admin" : isTeacher ? "teacher" : "student";

    await db
      .updateTable("mentorshipBookings")
      .set({
        status: "cancelled",
        cancellationReason: input.reason,
        cancelledAt: new Date(),
        cancelledBy,
        updatedAt: new Date(),
      })
      .where("id", "=", input.bookingId)
      .execute();

    const sessionLabel = `${booking.isTrial ? "Trial " : ""}1:1 session (${booking.durationMinutes} min)`;
    try {
      if (booking.studentEmail) {
        const tmpl = emailTemplatesExtra.mentorshipBookingCancelled(
          booking.studentName,
          booking.teacherName,
          sessionLabel,
          booking.scheduledAt,
          input.reason,
          true
        );
        await sendEmail({ to: booking.studentEmail, ...tmpl });
      }
      if (booking.teacherEmail) {
        const tmpl = emailTemplatesExtra.mentorshipBookingCancelled(
          booking.teacherName,
          booking.studentName,
          sessionLabel,
          booking.scheduledAt,
          input.reason,
          false
        );
        await sendEmail({ to: booking.teacherEmail, ...tmpl });
      }
    } catch (emailError) {
      console.error("Failed to send mentorship cancellation emails:", emailError);
    }

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to cancel mentorship booking:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
