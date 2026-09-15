import { db } from "../../helpers/db";
import { sql } from "kysely";
import { OutputType, SearchTeacherItem, schema } from "./search_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    const validation = schema.safeParse(searchParams);

    if (!validation.success) {
      return new Response(
        superjson.stringify({
          error: "Invalid query parameters",
          details: validation.error.flatten(),
        }),
        { status: 400 }
      );
    }

    const { q, limit = 5 } = validation.data;
    const searchTerm = `%${q}%`;

    // 1. Search Mock Tests
    const testsPromise = db
      .selectFrom("mockTests")
      .innerJoin("users", "users.id", "mockTests.teacherId")
      .select([
        "mockTests.id",
        "mockTests.slug",
        "mockTests.title",
        "mockTests.thumbnailUrl",
        "mockTests.price",
        "mockTests.discountPrice",
        "mockTests.examName",
        "mockTests.views",
        "users.displayName as teacherName",
        "users.isVerified as teacherIsVerified",
        "users.avatarUrl as teacherAvatarUrl",
        "users.tagline as teacherTagline",
        "users.yearsOfExperience as teacherYearsOfExperience",
        "users.slug as teacherSlug",
      ])
      .where("mockTests.isPublished", "=", true)
      .where("mockTests.deletedAt", "is", null)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("liveTests")
              .select("liveTests.id")
              .whereRef("liveTests.mockTestId", "=", "mockTests.id")
          )
        )
      )
      .where((eb) =>
        eb.or([
          eb("mockTests.title", "ilike", searchTerm),
          eb("mockTests.description", "ilike", searchTerm),
          eb("mockTests.subject", "ilike", searchTerm),
          eb("mockTests.examName", "ilike", searchTerm),
          eb("users.displayName", "ilike", searchTerm),
        ])
      )
      .orderBy(
        sql`(SELECT COUNT(*) FROM mock_test_enrollments WHERE mock_test_id = mock_tests.id AND enrolled_at > NOW() - INTERVAL '60 days')`,
        "desc"
      )
      .limit(limit)
      .execute();

    // 2. Search Courses
    const coursesPromise = db
      .selectFrom("courses")
      .innerJoin("users", "users.id", "courses.teacherId")
      .select([
        "courses.id",
        "courses.slug",
        "courses.title",
        "courses.thumbnailImageUrl as thumbnailUrl",
        "courses.price",
        "courses.views",
        "courses.category",
        "users.displayName as teacherName",
        "users.isVerified as teacherIsVerified",
        "users.avatarUrl as teacherAvatarUrl",
        "users.tagline as teacherTagline",
        "users.yearsOfExperience as teacherYearsOfExperience",
        "users.slug as teacherSlug",
      ])
      .where("courses.status", "=", "published")
      .where((eb) =>
        eb.or([
          eb("courses.title", "ilike", searchTerm),
          eb("courses.description", "ilike", searchTerm),
          eb("users.displayName", "ilike", searchTerm),
        ])
      )
      .orderBy(
        sql`(SELECT COUNT(*) FROM course_enrollments WHERE course_id = courses.id AND enrolled_at > NOW() - INTERVAL '60 days')`,
        "desc"
      )
      .limit(limit)
      .execute();

    // 3. Search Bundles
    const bundlesPromise = db
      .selectFrom("courseBundles")
      .innerJoin("users", "users.id", "courseBundles.teacherId")
      .select([
        "courseBundles.id",
        "courseBundles.slug",
        "courseBundles.title",
        "courseBundles.thumbnailUrl",
        "courseBundles.price",
        "courseBundles.originalPrice",
        "users.displayName as teacherName",
        "users.isVerified as teacherIsVerified",
        "users.avatarUrl as teacherAvatarUrl",
        "users.tagline as teacherTagline",
        "users.yearsOfExperience as teacherYearsOfExperience",
        "users.slug as teacherSlug",
      ])
      .select((eb) => [
        sql<number>`(
          SELECT COUNT(*)
          FROM course_bundle_items
          WHERE course_bundle_items.bundle_id = course_bundles.id
        )`.as("itemCount"),
      ])
      .where("courseBundles.isPublished", "=", true)
      .where((eb) =>
        eb.or([
          eb("courseBundles.title", "ilike", searchTerm),
          eb("courseBundles.description", "ilike", searchTerm),
          eb("users.displayName", "ilike", searchTerm),
        ])
      )
      .orderBy(
        sql`(SELECT COUNT(*) FROM bundle_enrollments WHERE bundle_id = course_bundles.id AND created_at > NOW() - INTERVAL '60 days')`,
        "desc"
      )
      .limit(limit)
      .execute();

    // 4. Search Digital Products
    const productsPromise = db
      .selectFrom("digitalProducts")
      .innerJoin("users", "users.id", "digitalProducts.teacherId")
      .select([
        "digitalProducts.id",
        "digitalProducts.slug",
        "digitalProducts.title",
        "digitalProducts.thumbnailUrl",
        "digitalProducts.price",
                "digitalProducts.views",
        "digitalProducts.category",
        "digitalProducts.examName",
        "users.displayName as teacherName",
        "users.isVerified as teacherIsVerified",
        "users.avatarUrl as teacherAvatarUrl",
        "users.tagline as teacherTagline",
        "users.yearsOfExperience as teacherYearsOfExperience",
        "users.slug as teacherSlug",
      ])
      .where("digitalProducts.status", "=", "published")
      .where("digitalProducts.isPublished", "=", true)
      .where((eb) =>
        eb.or([
          eb("digitalProducts.title", "ilike", searchTerm),
          eb("digitalProducts.description", "ilike", searchTerm),
          eb("users.displayName", "ilike", searchTerm),
        ])
      )
      .orderBy(
        sql`(SELECT COUNT(*) FROM digital_product_purchases WHERE product_id = digital_products.id AND purchased_at > NOW() - INTERVAL '60 days')`,
        "desc"
      )
      .limit(limit)
      .execute();

    // 5. Search Teachers
    const teachersPromise = db
      .selectFrom("users")
      .select([
        "users.id",
        "users.displayName",
        "users.avatarUrl",
        "users.slug",
        "users.isVerified",
      ])
      .select(() => [
        sql<number>`(SELECT COUNT(*) FROM mock_tests WHERE mock_tests.teacher_id = users.id AND mock_tests.is_published = true)`.as("testCount"),
        sql<number>`(SELECT COUNT(*) FROM courses WHERE courses.teacher_id = users.id AND courses.status = 'published')`.as("courseCount"),
        sql<number>`(SELECT COUNT(DISTINCT me.student_id) FROM mock_test_enrollments me INNER JOIN mock_tests mt ON mt.id = me.mock_test_id WHERE mt.teacher_id = users.id)`.as("studentCount"),
      ])
      .where("users.role", "=", "teacher")
      .where("users.isActive", "=", true)
      .where("users.displayName", "ilike", searchTerm)
      .where("users.slug", "is not", null)
      .where((eb) =>
        eb.or([
          eb.exists(
            eb
              .selectFrom("mockTests")
              .select("mockTests.id")
              .whereRef("mockTests.teacherId", "=", "users.id")
              .where("mockTests.isPublished", "=", true)
              .where("mockTests.deletedAt", "is", null)
              .limit(1)
          ),
          eb.exists(
            eb
              .selectFrom("courses")
              .select("courses.id")
              .whereRef("courses.teacherId", "=", "users.id")
              .where("courses.status", "=", "published")
              .limit(1)
          ),
        ])
      )
      .orderBy(
        sql`(
          SELECT COUNT(DISTINCT mock_test_enrollments.student_id)
          FROM mock_test_enrollments
          INNER JOIN mock_tests ON mock_tests.id = mock_test_enrollments.mock_test_id
          WHERE mock_tests.teacher_id = users.id
        )`,
        "desc"
      )
      .limit(5)
      .execute();

    const [tests, courses, bundles, products, teachers] = await Promise.all([
      testsPromise,
      coursesPromise,
      bundlesPromise,
      productsPromise,
      teachersPromise,
    ]);

    const formattedTests: OutputType["tests"] = tests.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      thumbnailUrl: t.thumbnailUrl,
      price: Number(t.price),
      discountPrice: t.discountPrice ? Number(t.discountPrice) : null,
      teacherName: t.teacherName,
      teacherIsVerified: !!t.teacherIsVerified,
      teacherAvatarUrl: t.teacherAvatarUrl ?? null,
      teacherTagline: t.teacherTagline ?? null,
      teacherYearsOfExperience: t.teacherYearsOfExperience ?? null,
      teacherSlug: t.teacherSlug ?? null,
      views: Number(t.views ?? 0),
          category: t.examName,
     type: "test",
     examName: t.examName ?? null,
    }));

    const formattedCourses: OutputType["courses"] = courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      thumbnailUrl: c.thumbnailUrl,
      price: Number(c.price),
      teacherName: c.teacherName,
      teacherIsVerified: !!c.teacherIsVerified,
      teacherAvatarUrl: c.teacherAvatarUrl ?? null,
      teacherTagline: c.teacherTagline ?? null,
      teacherYearsOfExperience: c.teacherYearsOfExperience ?? null,
      teacherSlug: c.teacherSlug ?? null,
      views: Number(c.views ?? 0),
     category: c.category,
     type: "course",
    }));

    const formattedBundles: OutputType["bundles"] = bundles.map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      thumbnailUrl: b.thumbnailUrl,
      price: Number(b.price),
      originalPrice: Number(b.originalPrice),
      teacherName: b.teacherName,
      teacherIsVerified: !!b.teacherIsVerified,
      teacherAvatarUrl: b.teacherAvatarUrl ?? null,
      teacherTagline: b.teacherTagline ?? null,
      teacherYearsOfExperience: b.teacherYearsOfExperience ?? null,
      teacherSlug: b.teacherSlug ?? null,
      itemCount: Number(b.itemCount),
      type: "bundle",
      views: 0,
      category: null,
    }));

    const formattedProducts: OutputType["products"] = products.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      thumbnailUrl: p.thumbnailUrl,
      price: Number(p.price),
      teacherName: p.teacherName,
      teacherIsVerified: !!p.teacherIsVerified,
      teacherAvatarUrl: p.teacherAvatarUrl ?? null,
      teacherTagline: p.teacherTagline ?? null,
      teacherYearsOfExperience: p.teacherYearsOfExperience ?? null,
      teacherSlug: p.teacherSlug ?? null,
      views: Number(p.views ?? 0),
            category: p.category,
      type: "product",
            examName: p.examName ?? null,
    }));

    const formattedTeachers: SearchTeacherItem[] = teachers.map((t) => ({
      id: t.id,
      displayName: t.displayName,
      avatarUrl: t.avatarUrl ?? null,
      slug: t.slug!,
      isVerified: t.isVerified,
      testCount: Number(t.testCount ?? 0),
      courseCount: Number(t.courseCount ?? 0),
      studentCount: Number(t.studentCount ?? 0),
    }));

    const totalResults =
      formattedTests.length +
      formattedCourses.length +
      formattedBundles.length +
      formattedProducts.length +
      formattedTeachers.length;

    const output: OutputType = {
      tests: formattedTests,
      courses: formattedCourses,
      bundles: formattedBundles,
      products: formattedProducts,
      teachers: formattedTeachers,
      totalResults,
    };

    return new Response(superjson.stringify(output), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error during homepage search:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to perform search",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}