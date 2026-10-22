import { db } from "../../helpers/db";
import { sql } from "kysely";
import { OutputType, SearchOrganizationItem, schema } from "./search_GET.schema";
import superjson from "superjson";
import { courseDiscountPrice } from "../../helpers/coursePricing";
import { searchTeachers } from "../../helpers/searchTeachers";

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
      .where("mockTests.visibility", "=", "public")
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
          sql<boolean>`EXISTS (
            SELECT 1 FROM mock_test_exams mte
            WHERE mte.mock_test_id = mock_tests.id AND mte.exam_name ILIKE ${searchTerm}
          )`,
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
        "courses.discountPrice",
        "courses.views",
        "courses.examName",
        "users.displayName as teacherName",
        "users.isVerified as teacherIsVerified",
        "users.avatarUrl as teacherAvatarUrl",
        "users.tagline as teacherTagline",
        "users.yearsOfExperience as teacherYearsOfExperience",
        "users.slug as teacherSlug",
      ])
      .where("courses.status", "=", "published")
      .where("courses.visibility", "=", "public")
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
      .where("courseBundles.visibility", "=", "public")
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
      .where("digitalProducts.visibility", "=", "public")
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
    const teachersPromise = searchTeachers({ q, limit });

    // 6. Search Organisations (coaching/school/college/university pages)
    const organizationsPromise = db
      .selectFrom("organizations")
      .select([
        "organizations.id",
        "organizations.name",
        "organizations.slug",
        "organizations.orgType",
        "organizations.logoUrl",
        "organizations.location",
      ])
      .select(() => [
        sql<number>`(
          SELECT COUNT(*) FROM organization_teachers
          WHERE organization_teachers.organization_id = organizations.id
          AND organization_teachers.status = 'approved'
        )`.as("teacherCount"),
        sql<number>`(
          SELECT COUNT(*) FROM organization_follows
          WHERE organization_follows.organization_id = organizations.id
        )`.as("followerCount"),
      ])
      .where("organizations.isActive", "=", true)
      .where((eb) =>
        eb.or([
          eb("organizations.name", "ilike", searchTerm),
          eb("organizations.description", "ilike", searchTerm),
          eb("organizations.location", "ilike", searchTerm),
        ])
      )
      .orderBy(
        sql`(SELECT COUNT(*) FROM organization_follows WHERE organization_follows.organization_id = organizations.id)`,
        "desc"
      )
      .limit(limit)
      .execute();

    const [tests, courses, bundles, products, teacherResults, organizations] = await Promise.all([
      testsPromise,
      coursesPromise,
      bundlesPromise,
      productsPromise,
      teachersPromise,
      organizationsPromise,
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
      discountPrice: courseDiscountPrice(c.price, c.discountPrice),
      teacherName: c.teacherName,
      teacherIsVerified: !!c.teacherIsVerified,
      teacherAvatarUrl: c.teacherAvatarUrl ?? null,
      teacherTagline: c.teacherTagline ?? null,
      teacherYearsOfExperience: c.teacherYearsOfExperience ?? null,
      teacherSlug: c.teacherSlug ?? null,
      views: Number(c.views ?? 0),
     category: c.examName ?? null,
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

    const formattedOrganizations: SearchOrganizationItem[] = organizations.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      orgType: o.orgType,
      logoUrl: o.logoUrl ?? null,
      location: o.location ?? null,
      teacherCount: Number(o.teacherCount ?? 0),
      followerCount: Number(o.followerCount ?? 0),
    }));

    const totalResults =
      formattedTests.length +
      formattedCourses.length +
      formattedBundles.length +
      formattedProducts.length +
      teacherResults.teachers.length +
      formattedOrganizations.length;

    const output: OutputType = {
      tests: formattedTests,
      courses: formattedCourses,
      bundles: formattedBundles,
      products: formattedProducts,
      teachers: teacherResults.teachers,
      organizations: formattedOrganizations,
      teacherTotal: teacherResults.total,
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