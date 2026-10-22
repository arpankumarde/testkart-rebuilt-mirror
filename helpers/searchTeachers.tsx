import { sql } from "kysely";
import { db } from "./db";
import type { SearchTeacherItem } from "../endpoints/homepage/search_GET.schema";

// Any active teacher with a profile link is searchable by name. Do not require
// published content or followers here.
export async function searchTeachers({
  q,
  limit,
  offset = 0,
}: {
  q: string;
  limit: number;
  offset?: number;
}): Promise<{ teachers: SearchTeacherItem[]; total: number }> {
  const matches = db
    .selectFrom("users")
    .where("users.role", "=", "teacher")
    .where("users.isActive", "=", true)
    .where("users.displayName", "ilike", `%${q}%`)
    .where("users.slug", "is not", null);

  const [rows, count] = await Promise.all([
    matches
      .select([
        "users.id",
        "users.displayName",
        "users.avatarUrl",
        "users.slug",
        "users.isVerified",
      ])
      .select(() => [
        sql<number>`(SELECT COUNT(*) FROM mock_tests WHERE mock_tests.teacher_id = users.id AND mock_tests.is_published = true AND mock_tests.visibility = 'public')`.as("testCount"),
        sql<number>`(SELECT COUNT(*) FROM courses WHERE courses.teacher_id = users.id AND courses.status = 'published' AND courses.visibility = 'public')`.as("courseCount"),
        sql<number>`(SELECT COUNT(DISTINCT me.student_id) FROM mock_test_enrollments me INNER JOIN mock_tests mt ON mt.id = me.mock_test_id WHERE mt.teacher_id = users.id)`.as("studentCount"),
        sql<number>`(
          (SELECT COUNT(*) FROM mock_tests WHERE mock_tests.teacher_id = users.id AND mock_tests.is_published = true AND mock_tests.deleted_at IS NULL AND mock_tests.visibility = 'public')
          + (SELECT COUNT(*) FROM courses WHERE courses.teacher_id = users.id AND courses.status = 'published' AND courses.visibility = 'public')
          + (SELECT COUNT(*) FROM digital_products WHERE digital_products.teacher_id = users.id AND digital_products.status = 'published' AND digital_products.visibility = 'public')
        )`.as("resourceCount"),
        sql<number>`(SELECT COUNT(*) FROM teacher_follows WHERE teacher_follows.teacher_id = users.id)`.as("followerCount"),
      ])
      .orderBy("studentCount", "desc")
      // Most teachers tie on students, so these keep pages stable and put name-prefix matches first.
      .orderBy(sql`users.display_name ILIKE ${`${q}%`}`, "desc")
      .orderBy(sql`LOWER(users.display_name)`, "asc")
      .orderBy("users.id", "asc")
      .limit(limit)
      .offset(offset)
      .execute(),
    matches
      .select((eb) => eb.fn.countAll<string>().as("total"))
      .executeTakeFirstOrThrow(),
  ]);

  return {
    teachers: rows.map((t) => ({
      id: t.id,
      displayName: t.displayName,
      avatarUrl: t.avatarUrl ?? null,
      slug: t.slug!,
      isVerified: t.isVerified,
      testCount: Number(t.testCount ?? 0),
      courseCount: Number(t.courseCount ?? 0),
      studentCount: Number(t.studentCount ?? 0),
      resourceCount: Number(t.resourceCount ?? 0),
      followerCount: Number(t.followerCount ?? 0),
    })),
    total: Number(count.total),
  };
}