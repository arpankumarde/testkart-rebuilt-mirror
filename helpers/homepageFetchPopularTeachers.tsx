import { db } from "./db";
import { buildTopSellingTeachersSql } from "./teacherEarningsSql";
import { HomepageTeacher } from "../endpoints/homepage/data_GET.schema";

const SALES_WINDOW_DAYS = 30;
const CANDIDATE_LIMIT = 30;
const OUTPUT_LIMIT = 10;

/**
 * Top teachers by the sale value of their content over the rolling last 30
 * days (buildTopSellingTeachersSql: completed, non-sponsored orders, with
 * refunded, cancelled and failed orders and unfinished live tests left out,
 * exactly as for earnings). The array order is the rank. Teachers who are
 * inactive, have no public profile or have nothing published are dropped
 * before ranks are assigned, so every rank leads to a profile with something
 * to buy. Followers, resources and studentCount are display-only.
 */
export async function fetchPopularTeachers(): Promise<HomepageTeacher[]> {
  const windowStart = new Date(Date.now() - SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const ranked = await buildTopSellingTeachersSql({ start: windowStart }, CANDIDATE_LIMIT).execute(db);
  const candidateIds = ranked.rows.map((r) => Number(r.teacherId)).filter(Number.isInteger);

  if (candidateIds.length === 0) {
    console.log("fetchPopularTeachers: no teacher sales in the last 30 days");
    return [];
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [teachers, testCounts, courseCounts, productCounts, followerCounts, enrollments] = await Promise.all([
    db
      .selectFrom("users")
      .where("users.id", "in", candidateIds)
      .where("users.role", "=", "teacher")
      .where("users.isActive", "=", true)
      .where("users.slug", "is not", null)
      .select([
        "users.id",
        "users.displayName",
        "users.avatarUrl",
        "users.slug",
        "users.isVerified",
        "users.tagline",
        "users.targetExams",
      ])
      .execute(),

    db
      .selectFrom("mockTests")
      .where("mockTests.teacherId", "in", candidateIds)
      .where("mockTests.isPublished", "=", true)
      .where("mockTests.deletedAt", "is", null)
      .where("mockTests.visibility", "=", "public")
      .groupBy("mockTests.teacherId")
      .select(["mockTests.teacherId", db.fn.count("mockTests.id").as("testCount")])
      .execute(),

    db
      .selectFrom("courses")
      .where("courses.teacherId", "in", candidateIds)
      .where("courses.status", "=", "published")
      .where("courses.visibility", "=", "public")
      .groupBy("courses.teacherId")
      .select(["courses.teacherId", db.fn.count("courses.id").as("courseCount")])
      .execute(),

    db
      .selectFrom("digitalProducts")
      .where("digitalProducts.teacherId", "in", candidateIds)
      .where("digitalProducts.status", "=", "published")
      .where("digitalProducts.visibility", "=", "public")
      .groupBy("digitalProducts.teacherId")
      .select(["digitalProducts.teacherId", db.fn.count("digitalProducts.id").as("productCount")])
      .execute(),

    db
      .selectFrom("teacherFollows")
      .where("teacherFollows.teacherId", "in", candidateIds)
      .groupBy("teacherFollows.teacherId")
      .select(["teacherFollows.teacherId", db.fn.count("teacherFollows.id").as("followerCount")])
      .execute(),

    // studentCount keeps its earlier meaning (enrolments in the last year) for the mobile app.
    Promise.all([
      db
        .selectFrom("mockTestEnrollments")
        .innerJoin("mockTests", "mockTests.id", "mockTestEnrollments.mockTestId")
        .where("mockTests.teacherId", "in", candidateIds)
        .where("mockTestEnrollments.enrolledAt", ">=", oneYearAgo)
        .groupBy("mockTests.teacherId")
        .select(["mockTests.teacherId", db.fn.count("mockTestEnrollments.id").as("enrollments")])
        .execute(),
      db
        .selectFrom("courseEnrollments")
        .innerJoin("courses", "courses.id", "courseEnrollments.courseId")
        .where("courses.teacherId", "in", candidateIds)
        .where("courseEnrollments.enrolledAt", ">=", oneYearAgo)
        .groupBy("courses.teacherId")
        .select(["courses.teacherId", db.fn.count("courseEnrollments.id").as("enrollments")])
        .execute(),
      db
        .selectFrom("digitalProductPurchases")
        .innerJoin("digitalProducts", "digitalProducts.id", "digitalProductPurchases.productId")
        .where("digitalProducts.teacherId", "in", candidateIds)
        .where("digitalProductPurchases.purchasedAt", ">=", oneYearAgo)
        .groupBy("digitalProducts.teacherId")
        .select(["digitalProducts.teacherId", db.fn.count("digitalProductPurchases.id").as("enrollments")])
        .execute(),
      db
        .selectFrom("liveTestEnrollments")
        .innerJoin("liveTests", "liveTests.id", "liveTestEnrollments.liveTestId")
        .where("liveTests.teacherId", "in", candidateIds)
        .where("liveTestEnrollments.enrolledAt", ">=", oneYearAgo)
        .groupBy("liveTests.teacherId")
        .select(["liveTests.teacherId", db.fn.count("liveTestEnrollments.id").as("enrollments")])
        .execute(),
    ]),
  ]);

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const testCountMap = new Map(testCounts.map((t) => [t.teacherId, Number(t.testCount)]));
  const courseCountMap = new Map(courseCounts.map((c) => [c.teacherId, Number(c.courseCount)]));
  const productCountMap = new Map(productCounts.map((p) => [p.teacherId, Number(p.productCount)]));
  const followerCountMap = new Map(followerCounts.map((f) => [f.teacherId, Number(f.followerCount)]));
  const enrollmentsMap = new Map<number, number>();
  for (const row of enrollments.flat()) {
    enrollmentsMap.set(row.teacherId, (enrollmentsMap.get(row.teacherId) ?? 0) + Number(row.enrollments ?? 0));
  }

  const result: HomepageTeacher[] = [];
  for (const id of candidateIds) {
    const t = teacherMap.get(id);
    if (!t) continue;
    const testCount = testCountMap.get(id) ?? 0;
    const courseCount = courseCountMap.get(id) ?? 0;
    const productCount = productCountMap.get(id) ?? 0;
    if (testCount + courseCount + productCount === 0) continue;

    result.push({
      id: t.id,
      displayName: t.displayName,
      avatarUrl: t.avatarUrl ?? null,
      slug: t.slug!,
      isVerified: t.isVerified,
      tagline: t.tagline ?? null,
      testCount,
      courseCount,
      productCount,
      studentCount: enrollmentsMap.get(id) ?? 0,
      followerCount: followerCountMap.get(id) ?? 0,
      targetExams: t.targetExams ? (Array.isArray(t.targetExams) ? (t.targetExams as string[]) : []) : null,
    });
    if (result.length === OUTPUT_LIMIT) break;
  }

  return result;
}
