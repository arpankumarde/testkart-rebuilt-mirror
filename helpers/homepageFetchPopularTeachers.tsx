import { db } from "./db";
import { HomepageTeacher } from "../endpoints/homepage/data_GET.schema";

const CANDIDATE_LIMIT = 50;
const OUTPUT_LIMIT = 10;

export async function fetchPopularTeachers(): Promise<HomepageTeacher[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Step 1: Collect revenue and enrollments in the last 30 days
  const [
    mockTestRev,
    courseRev,
    productRev,
    mockTestEnr,
    courseEnr,
    productEnr,
    liveTestEnr,
  ] = await Promise.all([
    // Revenue queries
    db
      .selectFrom("orderItems")
      .innerJoin("orders", "orders.id", "orderItems.orderId")
      .innerJoin("mockTests", "mockTests.id", "orderItems.mockTestId")
      .where("orders.status", "=", "completed")
      .where("orders.createdAt", ">=", thirtyDaysAgo)
      .groupBy("mockTests.teacherId")
      .select([
        "mockTests.teacherId",
        db.fn.sum("orderItems.priceAtPurchase").as("revenue"),
      ])
      .limit(CANDIDATE_LIMIT)
      .execute(),

    db
      .selectFrom("orderItems")
      .innerJoin("orders", "orders.id", "orderItems.orderId")
      .innerJoin("courses", "courses.id", "orderItems.courseId")
      .where("orders.status", "=", "completed")
      .where("orders.createdAt", ">=", thirtyDaysAgo)
      .groupBy("courses.teacherId")
      .select([
        "courses.teacherId",
        db.fn.sum("orderItems.priceAtPurchase").as("revenue"),
      ])
      .limit(CANDIDATE_LIMIT)
      .execute(),

    db
      .selectFrom("orderItems")
      .innerJoin("orders", "orders.id", "orderItems.orderId")
      .innerJoin("digitalProducts", "digitalProducts.id", "orderItems.digitalProductId")
      .where("orders.status", "=", "completed")
      .where("orders.createdAt", ">=", thirtyDaysAgo)
      .groupBy("digitalProducts.teacherId")
      .select([
        "digitalProducts.teacherId",
        db.fn.sum("orderItems.priceAtPurchase").as("revenue"),
      ])
      .limit(CANDIDATE_LIMIT)
      .execute(),

    // Enrollment queries
    db
      .selectFrom("mockTestEnrollments")
      .innerJoin("mockTests", "mockTests.id", "mockTestEnrollments.mockTestId")
      .where("mockTestEnrollments.enrolledAt", ">=", thirtyDaysAgo)
      .groupBy("mockTests.teacherId")
      .select([
        "mockTests.teacherId",
        db.fn.count("mockTestEnrollments.id").as("enrollments"),
      ])
      .limit(CANDIDATE_LIMIT)
      .execute(),

    db
      .selectFrom("courseEnrollments")
      .innerJoin("courses", "courses.id", "courseEnrollments.courseId")
      .where("courseEnrollments.enrolledAt", ">=", thirtyDaysAgo)
      .groupBy("courses.teacherId")
      .select([
        "courses.teacherId",
        db.fn.count("courseEnrollments.id").as("enrollments"),
      ])
      .limit(CANDIDATE_LIMIT)
      .execute(),

    db
      .selectFrom("digitalProductPurchases")
      .innerJoin("digitalProducts", "digitalProducts.id", "digitalProductPurchases.productId")
      .where("digitalProductPurchases.purchasedAt", ">=", thirtyDaysAgo)
      .groupBy("digitalProducts.teacherId")
      .select([
        "digitalProducts.teacherId",
        db.fn.count("digitalProductPurchases.id").as("enrollments"),
      ])
      .limit(CANDIDATE_LIMIT)
      .execute(),

    db
      .selectFrom("liveTestEnrollments")
      .innerJoin("liveTests", "liveTests.id", "liveTestEnrollments.liveTestId")
      .where("liveTestEnrollments.enrolledAt", ">=", thirtyDaysAgo)
      .groupBy("liveTests.teacherId")
      .select([
        "liveTests.teacherId",
        db.fn.count("liveTestEnrollments.id").as("enrollments"),
      ])
      .limit(CANDIDATE_LIMIT)
      .execute(),
  ]);

  // Step 2: Merge data and calculate scores
  const scoreMap = new Map<number, number>();
  const enrollmentsMap = new Map<number, number>();

  const addRev = (rows: { teacherId: number; revenue: string | number | bigint | null }[]) => {
    for (const row of rows) {
      scoreMap.set(
        row.teacherId,
        (scoreMap.get(row.teacherId) ?? 0) + Number(row.revenue ?? 0)
      );
    }
  };

  const addEnr = (rows: { teacherId: number; enrollments: string | number | bigint | null }[]) => {
    for (const row of rows) {
      const cnt = Number(row.enrollments ?? 0);
      enrollmentsMap.set(
        row.teacherId,
        (enrollmentsMap.get(row.teacherId) ?? 0) + cnt
      );
      scoreMap.set(
        row.teacherId,
        (scoreMap.get(row.teacherId) ?? 0) + cnt
      );
    }
  };

  addRev(mockTestRev);
  addRev(courseRev);
  addRev(productRev);
  addEnr(mockTestEnr);
  addEnr(courseEnr);
  addEnr(productEnr);
  addEnr(liveTestEnr);

  const topTeacherIds = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, OUTPUT_LIMIT)
    .map(([id]) => id);

  if (topTeacherIds.length === 0) {
    console.log("fetchPopularTeachers: no teachers found");
    return [];
  }

  // Step 3: Fetch teacher details + individual content counts in parallel
  const [teachers, testCounts, courseCounts, productCounts] = await Promise.all([
    db
      .selectFrom("users")
      .where("users.id", "in", topTeacherIds)
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
      .where("mockTests.teacherId", "in", topTeacherIds)
      .where("mockTests.isPublished", "=", true)
      .where("mockTests.deletedAt", "is", null)
      .groupBy("mockTests.teacherId")
      .select([
        "mockTests.teacherId",
        db.fn.count("mockTests.id").as("testCount"),
      ])
      .execute(),

    db
      .selectFrom("courses")
      .where("courses.teacherId", "in", topTeacherIds)
      .where("courses.status", "=", "published")
      .groupBy("courses.teacherId")
      .select([
        "courses.teacherId",
        db.fn.count("courses.id").as("courseCount"),
      ])
      .execute(),

    db
      .selectFrom("digitalProducts")
      .where("digitalProducts.teacherId", "in", topTeacherIds)
      .where("digitalProducts.status", "=", "published")
      .groupBy("digitalProducts.teacherId")
      .select([
        "digitalProducts.teacherId",
        db.fn.count("digitalProducts.id").as("productCount"),
      ])
      .execute(),
  ]);

  const testCountMap = new Map(testCounts.map((t) => [t.teacherId, Number(t.testCount)]));
  const courseCountMap = new Map(courseCounts.map((c) => [c.teacherId, Number(c.courseCount)]));
  const productCountMap = new Map(productCounts.map((p) => [p.teacherId, Number(p.productCount)]));

  return teachers
    .map((t) => ({
      id: t.id,
      displayName: t.displayName,
      avatarUrl: t.avatarUrl ?? null,
      slug: t.slug!,
      isVerified: t.isVerified,
      tagline: t.tagline ?? null,
      testCount: testCountMap.get(t.id) ?? 0,
      courseCount: courseCountMap.get(t.id) ?? 0,
      productCount: productCountMap.get(t.id) ?? 0,
      studentCount: enrollmentsMap.get(t.id) ?? 0,
      targetExams: t.targetExams ? (Array.isArray(t.targetExams) ? t.targetExams as string[] : []) : null,
    }))
    .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
}