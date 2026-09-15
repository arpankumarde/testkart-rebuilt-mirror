import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql, RawBuilder } from "kysely";
import { buildTeacherNetEarningsSql } from "../../../helpers/teacherEarningsSql";

// Re-wrap the shared { total: string }-typed builder as a plain string-typed scalar
// expression for use as a single column in this paginated SELECT list.
function asScalar(builder: RawBuilder<{ total: string }>) {
  return sql<string>`${builder}`;
}

const teacherIdRef = sql.ref("users.id");

function getSortExpression(sortBy: string) {
  switch (sortBy) {
    case "name":
      return "users.displayName" as const;
    case "email":
      return "users.email" as const;
    case "createdAt":
      return "users.createdAt" as const;
    case "testsCount":
      return sql`"tests_count"`;
    case "bundlesCount":
      return sql`"bundles_count"`;
    case "coursesCount":
      return sql`"courses_count"`;
    case "liveTestsCount":
      return sql`"live_tests_count"`;
    case "productsCount":
      return sql`"products_count"`;
    case "totalEarnings":
      return sql`"total_earnings"`;
    default:
      return "users.createdAt" as const;
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = (url.searchParams.get("sortOrder") || "desc") as "asc" | "desc";

    const baseQuery = db
      .selectFrom("users")
      .where("users.role", "=", "teacher");

    let teachersQuery = baseQuery
      .selectAll("users")
      .select([
        sql<string>`(
          SELECT COUNT(*) 
          FROM mock_tests 
          WHERE mock_tests.teacher_id = users.id
        )`.as("testsCount"),
        sql<string>`(
          SELECT COUNT(*)
          FROM course_bundles
          WHERE course_bundles.teacher_id = users.id
        )`.as("bundlesCount"),
        sql<string>`(
          SELECT COUNT(*)
          FROM courses
          WHERE courses.teacher_id = users.id
        )`.as("coursesCount"),
        sql<string>`(
          SELECT COUNT(*)
          FROM live_tests
          WHERE live_tests.teacher_id = users.id
        )`.as("liveTestsCount"),
        sql<string>`(
          SELECT COUNT(*)
          FROM digital_products
          WHERE digital_products.teacher_id = users.id
        )`.as("productsCount"),
        // Net teacher earnings (gross minus discount, minus platform fee at time of sale) across
        // ALL product types, built from the single shared formula in helpers/teacherEarningsSql.tsx.
        // (Previously this summed raw oi.price_at_purchase with no fee/discount deducted and no
        // bundle sales included, so it showed near-gross revenue rather than actual earnings.)
        asScalar(buildTeacherNetEarningsSql(teacherIdRef)).as("totalEarnings"),
      ])
      .orderBy(getSortExpression(sortBy), sortOrder)
      .limit(limit)
      .offset(offset);

    let countQuery = baseQuery.select((eb) =>
      eb.fn.countAll<string>().as("count")
    );

    if (search) {
      const searchQuery = `%${search}%`;
            teachersQuery = teachersQuery.where((eb) =>
        eb.or([
          eb("users.displayName", "ilike", searchQuery),
          eb("users.email", "ilike", searchQuery),
          eb("users.mobileNumber", "ilike", searchQuery),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("users.displayName", "ilike", searchQuery),
          eb("users.email", "ilike", searchQuery),
          eb("users.mobileNumber", "ilike", searchQuery),
        ])
      );
    }

    const [teachers, totalResult] = await Promise.all([
      teachersQuery.execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    const totalCount = parseInt(totalResult.count, 10);
    const totalPages = Math.ceil(totalCount / limit);

    const output: OutputType = {
      teachers: teachers.map((t) => ({
        id: t.id,
        fullName: t.displayName,
        email: t.email ?? "N/A",
        mobileNumber: t.mobileNumber,
        academyName: t.academyName,
        createdAt: t.createdAt,
        isActive: t.isActive,
        isVerified: t.isVerified,
        testsCount: parseInt(t.testsCount as any, 10),
        bundlesCount: parseInt(t.bundlesCount as any, 10),
        coursesCount: parseInt(t.coursesCount as any, 10),
        liveTestsCount: parseInt(t.liveTestsCount as any, 10),
        productsCount: parseInt(t.productsCount as any, 10),
        totalEarnings: parseFloat(t.totalEarnings as any),
        onboardingCompleted: t.onboardingCompleted,
        instituteType: t.instituteType,
        location: t.location,
        bio: t.bio,
        tagline: t.tagline,
        expertiseAreas: t.expertiseAreas,
        languages: t.languages,
        socialLinks: t.socialLinks,
        yearsOfExperience: t.yearsOfExperience,
        teachingCategories: t.teachingCategories,
        targetExams: t.targetExams,
        teachingExperienceLevel: t.teachingExperienceLevel,
        currentOccupation: t.currentOccupation,
        goals: t.goals,
        discoverySource: t.discoverySource,
        schoolCollegeName: t.schoolCollegeName,
        signupSource: t.signupSource,
        productInterest: t.productInterest,
        websiteUrl: t.websiteUrl,
      })),
      totalCount,
      currentPage: page,
      totalPages,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching teachers list:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}