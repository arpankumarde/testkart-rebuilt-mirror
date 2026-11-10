import superjson from "superjson";
import { toZonedTime } from "date-fns-tz";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { isTeacherSlotBookable } from "../../../helpers/mentorshipSlots";
import { CREDIT_SCHEDULE_MAX_DAYS } from "../../../helpers/liveLessonConfig";
import { bookCredit, isStudentFree, LIVE_PACKAGE_STATUSES, teacherBookingLock } from "../../../helpers/livePackages";
import { schema, OutputType } from "./schedule_POST.schema";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const { creditId, startTime } = schema.parse(superjson.parse(await request.text()));

    if (startTime.getTime() > Date.now() + CREDIT_SCHEDULE_MAX_DAYS * 24 * 60 * 60000) {
      return fail(`Pick a time within the next ${CREDIT_SCHEDULE_MAX_DAYS} days.`);
    }

    const result = await db.transaction().execute(async (trx) => {
      const credit = await trx
        .selectFrom("liveClassCredits")
        .innerJoin("livePackages", "livePackages.id", "liveClassCredits.packageId")
        .innerJoin("users as teacher", "teacher.id", "liveClassCredits.teacherId")
        .select([
          "liveClassCredits.id",
          "liveClassCredits.studentId",
          "liveClassCredits.teacherId",
          "liveClassCredits.kind",
          "liveClassCredits.packageId",
          "liveClassCredits.orderId",
          "liveClassCredits.classMinutes",
          "liveClassCredits.amount",
          "liveClassCredits.status",
          "livePackages.status as packageStatus",
          "teacher.timezone",
        ])
        .where("liveClassCredits.id", "=", creditId)
        .forUpdate()
        .executeTakeFirst();
      if (!credit || credit.studentId !== user.id) throw new Error("Class not found.");
      if (credit.status !== "unscheduled") throw new Error("This class already has a time.");
      if (!(LIVE_PACKAGE_STATUSES as readonly string[]).includes(credit.packageStatus)) throw new Error("This package has stopped.");

      await teacherBookingLock(credit.teacherId).execute(trx);
      const slot = await isTeacherSlotBookable(credit.teacherId, startTime, credit.classMinutes, trx);
      if (!slot.ok) throw new Error(slot.reason);
      if (!(await isStudentFree(trx, user.id, startTime, credit.classMinutes))) throw new Error("You already have a class at this time.");

      const zoned = toZonedTime(startTime, credit.timezone);
      const sameDay = await trx
        .selectFrom("mentorshipBookings")
        .select("scheduledAt")
        .where("studentId", "=", user.id)
        .where("teacherId", "=", credit.teacherId)
        .where("status", "!=", "cancelled")
        .where("scheduledAt", ">", new Date(startTime.getTime() - 24 * 60 * 60000))
        .where("scheduledAt", "<", new Date(startTime.getTime() + 24 * 60 * 60000))
        .execute();
      const clash = sameDay.some((b) => {
        const z = toZonedTime(new Date(b.scheduledAt), credit.timezone);
        return z.getFullYear() === zoned.getFullYear() && z.getMonth() === zoned.getMonth() && z.getDate() === zoned.getDate();
      });
      if (clash) throw new Error("You already have a class with this teacher that day.");

      const bookingId = await bookCredit(trx, credit, startTime);
      return { bookingId, scheduledAt: startTime };
    });

    const output: OutputType = result;
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Schedule credit failed:", error);
    return fail(error instanceof Error ? error.message : "Could not book this class.");
  }
}
