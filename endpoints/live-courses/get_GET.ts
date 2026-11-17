import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { loadCourseDetail } from "../../helpers/liveCourseData";
import { isRefundable, refundClosesAt } from "../../helpers/liveCourseServer";
import { schema, type LiveCourseViewer, type OutputType } from "./get_GET.schema";

export async function handle(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const input = schema.parse({ slug: params.get("slug") ?? undefined, id: params.get("id") ?? undefined });
    const course = await loadCourseDetail(input.id ? { id: input.id } : { slug: input.slug as string });
    if (!course) return new Response(superjson.stringify({ error: "Live course not found." }), { status: 404 });

    const viewer: LiveCourseViewer = { role: "guest", isOwner: false, enrollment: null, canRefund: false, attendance: [] };
    let effectiveTeacherId: number | null = null;
    try {
      const session = await getServerUserSession(request);
      viewer.role = session.user.role as LiveCourseViewer["role"];
      effectiveTeacherId = session.effectiveTeacherId;
      if (session.user.role === "student") {
        const enrollment = await db
          .selectFrom("liveCourseEnrollments")
          .select(["id", "status", "enrolledAt", "refundedAt", "refundStatus"])
          .where("liveCourseId", "=", course.id)
          .where("studentId", "=", session.user.id)
          .orderBy("createdAt", "desc")
          .executeTakeFirst();
        if (enrollment) {
          viewer.enrollment = { ...enrollment, status: enrollment.status as "enrolled" | "refunded" | "removed" };
          const classIds = course.classes.map((c) => c.id);
          if (classIds.length) {
            viewer.attendance = await db
              .selectFrom("liveCourseAttendance")
              .select(["groupLessonId as classId", "present"])
              .where("studentId", "=", session.user.id)
              .where("groupLessonId", "in", classIds)
              .execute();
          }
        }
      }
    } catch {
      // Signed out: the public view.
    }
    viewer.isOwner = viewer.role === "admin" || (viewer.role === "teacher" && effectiveTeacherId === course.teacher.id);

    if (course.status === "draft" && !viewer.isOwner) {
      return new Response(superjson.stringify({ error: "Live course not found." }), { status: 404 });
    }

    const [teacher, closesAt] = await Promise.all([
      db.selectFrom("teachers").select(["bio", "tagline"]).where("id", "=", course.teacher.id).executeTakeFirst(),
      refundClosesAt(course.id),
    ]);
    if (viewer.enrollment?.status === "enrolled" && course.status === "published") {
      viewer.canRefund = isRefundable(viewer.enrollment.enrolledAt, closesAt);
    }

    const now = Date.now();
    const seatsLeft = Math.max(0, course.seatLimit - course.enrolledCount);
    const hasUpcoming = course.classes.some((c) => c.status === "scheduled" && new Date(c.startTime).getTime() > now);
    const closedReason: OutputType["closedReason"] =
      course.status === "cancelled" || course.status === "completed" || !hasUpcoming
        ? "ended"
        : course.status !== "published"
          ? "not_open"
          : course.registrationDeadline && new Date(course.registrationDeadline).getTime() <= now
            ? "deadline"
            : seatsLeft === 0
              ? "full"
              : null;

    const output: OutputType = {
      course: { ...course, teacherBio: teacher?.bio ?? null, teacherTagline: teacher?.tagline ?? null },
      seatsLeft,
      closedReason,
      refundClosesAt: closesAt,
      viewer,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error loading live course:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}
