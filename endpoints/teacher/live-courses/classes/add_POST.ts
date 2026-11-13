import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { LiveCourseError, errorResponse, getManagedCourse, syncCourseDates } from "../../../../helpers/liveCourseServer";
import { LIVE_COURSE_MAX_CLASSES, LIVE_COURSE_SEAT_LIMIT_MAX, expandWeeklyPattern, formatIstShort } from "../../../../helpers/liveCourseRules";
import { sendClassChangeNotices, type ClassChange } from "../../../../helpers/liveCourseNotices";
import { schema, type OutputType } from "./add_POST.schema";

const overlaps = (aStart: number, aMin: number, bStart: number, bMin: number) =>
  aStart < bStart + bMin * 60000 && bStart < aStart + aMin * 60000;

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const course = await getManagedCourse(input.liveCourseId, user, effectiveTeacherId);
    if (course.status === "cancelled" || course.status === "completed") {
      throw new LiveCourseError(`Classes cannot be added to a ${course.status} live course.`);
    }

    const existingCount = Number(
      (
        await db
          .selectFrom("groupLessons")
          .select(db.fn.countAll<string>().as("n"))
          .where("liveCourseId", "=", course.id)
          .where("status", "!=", "cancelled")
          .executeTakeFirstOrThrow()
      ).n
    );

    let planned: { title: string; startTime: Date; durationMinutes: number; topicId: string | null }[];
    if (input.mode === "single") {
      if (input.topicId) {
        const topic = await db
          .selectFrom("liveCourseTopics")
          .innerJoin("liveCourseModules", "liveCourseModules.id", "liveCourseTopics.moduleId")
          .select("liveCourseTopics.id")
          .where("liveCourseTopics.id", "=", input.topicId)
          .where("liveCourseModules.liveCourseId", "=", course.id)
          .executeTakeFirst();
        if (!topic) throw new LiveCourseError("That topic is not in this course's syllabus.");
      }
      planned = [{ title: input.title, startTime: input.startTime, durationMinutes: input.durationMinutes, topicId: input.topicId ?? null }];
    } else {
      planned = expandWeeklyPattern(input).map((c, i) => ({
        ...c,
        title: `${input.titlePrefix} ${existingCount + i + 1}`,
        topicId: null,
      }));
      if (planned.length === 0) throw new LiveCourseError("No dates in that range fall on the days you picked.");
    }

    if (existingCount + planned.length > LIVE_COURSE_MAX_CLASSES) {
      throw new LiveCourseError(`A live course can have at most ${LIVE_COURSE_MAX_CLASSES} classes.`);
    }
    const now = Date.now();
    const past = planned.find((c) => c.startTime.getTime() <= now);
    if (past) throw new LiveCourseError(`${formatIstShort(past.startTime)} IST has already passed.`);

    // One calendar per teacher: 1:1 bookings, live course classes and any other live class.
    const [bookings, lessons] = await Promise.all([
      db
        .selectFrom("mentorshipBookings")
        .select(["scheduledAt as start", "durationMinutes"])
        .where("teacherId", "=", course.teacherId)
        .where("status", "!=", "cancelled")
        .where("scheduledAt", ">", new Date(now - 24 * 3600000))
        .execute(),
      db
        .selectFrom("groupLessons")
        .select(["startTime as start", "durationMinutes"])
        .where("teacherId", "=", course.teacherId)
        .where("status", "=", "scheduled")
        .execute(),
    ]);
    const busy = [...bookings, ...lessons].map((b) => ({ start: new Date(b.start).getTime(), min: b.durationMinutes }));
    const clashes: string[] = [];
    planned.forEach((c, i) => {
      const s = c.startTime.getTime();
      const clash =
        busy.some((b) => overlaps(s, c.durationMinutes, b.start, b.min)) ||
        planned.some((o, j) => j < i && overlaps(s, c.durationMinutes, o.startTime.getTime(), o.durationMinutes));
      if (clash) clashes.push(formatIstShort(c.startTime));
    });
    if (clashes.length) {
      const shown = clashes.slice(0, 5).join(", ");
      throw new LiveCourseError(
        `You already have a class at ${shown}${clashes.length > 5 ? ` and ${clashes.length - 5} more` : ""} (IST). Pick other times.`
      );
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("groupLessons")
        .values(
          planned.map((c) => ({
            teacherId: course.teacherId,
            liveCourseId: course.id,
            topicId: c.topicId,
            title: c.title,
            startTime: c.startTime,
            durationMinutes: c.durationMinutes,
            pricePerLearner: "0",
            maxCapacity: LIVE_COURSE_SEAT_LIMIT_MAX,
            language: course.languages[0] ?? null,
            level: course.level,
          }))
        )
        .execute();
      await syncCourseDates(trx, course.id);
    });

    if (course.status === "published") {
      const changes: ClassChange[] = planned.map((c) => ({ kind: "added", title: c.title, startTime: c.startTime }));
      await sendClassChangeNotices(course.id, changes);
    }

    const output: OutputType = { added: planned.length };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error adding live course classes:", error);
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
