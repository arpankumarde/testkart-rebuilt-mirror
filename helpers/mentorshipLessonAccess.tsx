import { db } from "./db";
import { Selectable } from "kysely";
import { Users } from "./schema";

export type LessonKind = "booking" | "group";

export interface LessonAccessContext {
  kind: LessonKind;
  id: string;
  title: string;
  teacherId: number;
  teacherName: string;
  startTime: Date;
  durationMinutes: number;
  status: string;
  /** The requesting user's role in this specific lesson. */
  viewerRole: "teacher" | "learner";
  /** Set when the group lesson is a class of a live course. */
  liveCourseId?: string | null;
}

export class LessonAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolves a booking/group lesson and checks that `user` is either the teacher who owns it (or a
 * team member acting for that teacher, via `effectiveTeacherId`), an admin, or a learner with an
 * active booking/enrollment in it. Throws LessonAccessError otherwise. This is the
 * single place server-side ownership/membership is enforced for the classroom - every endpoint
 * that touches chat, materials, attendance or join credentials must call this first and must never
 * rely on the client to have hidden a button instead.
 */
export async function getLessonAccessContext(
  kind: LessonKind,
  id: string,
  user: Pick<Selectable<Users>, "id" | "role">,
  effectiveTeacherId: number = user.id
): Promise<LessonAccessContext> {
  if (kind === "booking") {
    const booking = await db
      .selectFrom("mentorshipBookings")
      .innerJoin("teachers as teacher", "teacher.id", "mentorshipBookings.teacherId")
      .select([
        "mentorshipBookings.id",
        "mentorshipBookings.teacherId",
        "mentorshipBookings.studentId",
        "mentorshipBookings.scheduledAt",
        "mentorshipBookings.durationMinutes",
        "mentorshipBookings.status",
        "mentorshipBookings.isTrial",
        "teacher.displayName as teacherName",
      ])
      .where("mentorshipBookings.id", "=", id)
      .executeTakeFirst();

    if (!booking) throw new LessonAccessError("Booking not found", 404);

    const isTeacher = user.role === "teacher" && booking.teacherId === effectiveTeacherId;
    const isStudent = user.role === "student" && booking.studentId === user.id;
    const isAdmin = user.role === "admin";
    if (!isTeacher && !isStudent && !isAdmin) {
      throw new LessonAccessError("You are not a participant in this session.");
    }

    return {
      kind: "booking",
      id: booking.id,
      title: `${booking.isTrial ? "Trial " : ""}1:1 session (${booking.durationMinutes} min)`,
      teacherId: booking.teacherId,
      teacherName: booking.teacherName,
      startTime: booking.scheduledAt,
      durationMinutes: booking.durationMinutes,
      status: booking.status ?? "scheduled",
      // Admins viewing for moderation get teacher-level classroom controls rather than learner ones.
      viewerRole: isStudent ? "learner" : "teacher",
    };
  }

  const lesson = await db
    .selectFrom("groupLessons")
    .innerJoin("teachers as teacher", "teacher.id", "groupLessons.teacherId")
    .select([
      "groupLessons.id",
      "groupLessons.teacherId",
      "groupLessons.title",
      "groupLessons.startTime",
      "groupLessons.durationMinutes",
      "groupLessons.status",
      "groupLessons.liveCourseId",
      "teacher.displayName as teacherName",
    ])
    .where("groupLessons.id", "=", id)
    .executeTakeFirst();

  if (!lesson) throw new LessonAccessError("Group lesson not found", 404);

  const isTeacher = user.role === "teacher" && lesson.teacherId === effectiveTeacherId;
  const isAdmin = user.role === "admin";
  let isEnrolledLearner = false;
  if (user.role === "student") {
    // A live course class admits the course's enrolled students; a standalone lesson its own learners.
    const enrollment = lesson.liveCourseId
      ? await db
          .selectFrom("liveCourseEnrollments")
          .select("id")
          .where("liveCourseId", "=", lesson.liveCourseId)
          .where("studentId", "=", user.id)
          .where("status", "=", "enrolled")
          .executeTakeFirst()
      : await db
          .selectFrom("groupLessonEnrollments")
          .select("id")
          .where("groupLessonId", "=", lesson.id)
          .where("studentId", "=", user.id)
          .where("status", "=", "enrolled")
          .executeTakeFirst();
    isEnrolledLearner = !!enrollment;
  }

  if (!isTeacher && !isEnrolledLearner && !isAdmin) {
    throw new LessonAccessError(
      lesson.liveCourseId ? "You are not enrolled in this live course." : "You are not enrolled in this group lesson."
    );
  }

  return {
    kind: "group",
    id: lesson.id,
    title: lesson.title,
    teacherId: lesson.teacherId,
    teacherName: lesson.teacherName,
    startTime: lesson.startTime,
    durationMinutes: lesson.durationMinutes,
    status: lesson.status,
    // As with bookings, admins viewing for moderation get teacher-level classroom controls.
    viewerRole: isEnrolledLearner ? "learner" : "teacher",
    liveCourseId: lesson.liveCourseId,
  };
}
