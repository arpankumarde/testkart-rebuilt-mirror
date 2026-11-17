import { db } from "./db";
import type { LiveCourseLevel, LiveCourseStatus } from "./liveCourseRules";

/* Read models for live courses, shared by the teacher, public, student and admin endpoints. */

export type LiveCourseClass = {
  id: string;
  title: string;
  startTime: Date;
  durationMinutes: number;
  status: "scheduled" | "cancelled" | "completed";
  /** The teacher never joined: stored cancelled with missed_at. */
  missed: boolean;
  topicId: string | null;
  cancellationReason: string | null;
};

export type LiveCourseModule = {
  id: string;
  title: string;
  topics: { id: string; title: string }[];
};

export type LiveCourseSummary = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  examId: number | null;
  examName: string | null;
  languages: string[];
  level: LiveCourseLevel;
  price: number;
  originalPrice: number | null;
  seatLimit: number;
  enrolledCount: number;
  registrationDeadline: Date | null;
  startsOn: Date | null;
  endsOn: Date | null;
  status: LiveCourseStatus;
  classCount: number;
  teacher: { id: number; name: string; slug: string | null; avatarUrl: string | null };
};

export type LiveCourseDetail = LiveCourseSummary & {
  description: string;
  thumbnailFileId: string | null;
  defaultClassMinutes: number;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  modules: LiveCourseModule[];
  classes: LiveCourseClass[];
};

type SummaryRow = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  examId: number | null;
  examName: string | null;
  languages: string[];
  level: string;
  price: string;
  originalPrice: string | null;
  seatLimit: number;
  enrolledCount: number;
  registrationDeadline: Date | null;
  startsOn: Date | null;
  endsOn: Date | null;
  status: string;
  teacherId: number;
  teacherName: string;
  teacherSlug: string | null;
  teacherAvatarUrl: string | null;
};

function summaryQuery() {
  return db
    .selectFrom("liveCourses")
    .innerJoin("teachers as teacher", "teacher.id", "liveCourses.teacherId")
    .select([
      "liveCourses.id",
      "liveCourses.slug",
      "liveCourses.title",
      "liveCourses.thumbnailUrl",
      "liveCourses.examId",
      "liveCourses.examName",
      "liveCourses.languages",
      "liveCourses.level",
      "liveCourses.price",
      "liveCourses.originalPrice",
      "liveCourses.seatLimit",
      "liveCourses.enrolledCount",
      "liveCourses.registrationDeadline",
      "liveCourses.startsOn",
      "liveCourses.endsOn",
      "liveCourses.status",
      "teacher.id as teacherId",
      "teacher.displayName as teacherName",
      "teacher.slug as teacherSlug",
      "teacher.avatarUrl as teacherAvatarUrl",
    ]);
}

export { summaryQuery as liveCourseSummaryQuery };

async function classCounts(courseIds: string[]): Promise<Map<string, number>> {
  if (courseIds.length === 0) return new Map();
  const rows = await db
    .selectFrom("groupLessons")
    .select(["liveCourseId", db.fn.countAll<string>().as("n")])
    .where("liveCourseId", "in", courseIds)
    .where("status", "!=", "cancelled")
    .groupBy("liveCourseId")
    .execute();
  return new Map(rows.map((r) => [r.liveCourseId as string, Number(r.n)]));
}

export async function toSummaries(rows: SummaryRow[]): Promise<LiveCourseSummary[]> {
  const counts = await classCounts(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    thumbnailUrl: r.thumbnailUrl,
    examId: r.examId,
    examName: r.examName,
    languages: r.languages ?? [],
    level: r.level as LiveCourseLevel,
    price: Number(r.price),
    originalPrice: r.originalPrice === null ? null : Number(r.originalPrice),
    seatLimit: r.seatLimit,
    enrolledCount: r.enrolledCount,
    registrationDeadline: r.registrationDeadline,
    startsOn: r.startsOn,
    endsOn: r.endsOn,
    status: r.status as LiveCourseStatus,
    classCount: counts.get(r.id) ?? 0,
    teacher: { id: r.teacherId, name: r.teacherName, slug: r.teacherSlug, avatarUrl: r.teacherAvatarUrl },
  }));
}

export async function loadCourseClasses(courseId: string): Promise<LiveCourseClass[]> {
  const rows = await db
    .selectFrom("groupLessons")
    .select(["id", "title", "startTime", "durationMinutes", "status", "missedAt", "topicId", "cancellationReason"])
    .where("liveCourseId", "=", courseId)
    .orderBy("startTime", "asc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startTime: r.startTime,
    durationMinutes: r.durationMinutes,
    status: r.status,
    missed: r.missedAt !== null,
    topicId: r.topicId,
    cancellationReason: r.cancellationReason,
  }));
}

export async function loadCourseModules(courseId: string): Promise<LiveCourseModule[]> {
  const modules = await db
    .selectFrom("liveCourseModules")
    .select(["id", "title"])
    .where("liveCourseId", "=", courseId)
    .orderBy("position", "asc")
    .execute();
  if (modules.length === 0) return [];
  const topics = await db
    .selectFrom("liveCourseTopics")
    .select(["id", "title", "moduleId"])
    .where("moduleId", "in", modules.map((m) => m.id))
    .orderBy("position", "asc")
    .execute();
  return modules.map((m) => ({
    id: m.id,
    title: m.title,
    topics: topics.filter((t) => t.moduleId === m.id).map((t) => ({ id: t.id, title: t.title })),
  }));
}

export async function loadCourseDetail(where: { id: string } | { slug: string }): Promise<LiveCourseDetail | null> {
  const base = await summaryQuery()
    .select([
      "liveCourses.description",
      "liveCourses.thumbnailFileId",
      "liveCourses.defaultClassMinutes",
      "liveCourses.publishedAt",
      "liveCourses.cancelledAt",
      "liveCourses.cancellationReason",
    ])
    .where("id" in where ? "liveCourses.id" : "liveCourses.slug", "=", "id" in where ? where.id : where.slug)
    .executeTakeFirst();
  if (!base) return null;
  const [[summary], modules, classes] = await Promise.all([
    toSummaries([base]),
    loadCourseModules(base.id),
    loadCourseClasses(base.id),
  ]);
  return {
    ...summary,
    description: base.description,
    thumbnailFileId: base.thumbnailFileId,
    defaultClassMinutes: base.defaultClassMinutes,
    publishedAt: base.publishedAt,
    cancelledAt: base.cancelledAt,
    cancellationReason: base.cancellationReason,
    modules,
    classes,
  };
}
