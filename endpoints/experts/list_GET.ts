import { db } from "../../helpers/db";
import { schema, OutputType, ExpertListItem } from "./list_GET.schema";
import { MENTORSHIP_RATE_UNIT_MINUTES, MENTORSHIP_MIN_RATE_PER_UNIT } from "../../helpers/liveLessonConfig";
import { resolveLivePrices } from "../../helpers/livePricing";
import { sql } from "kysely";
import superjson from "superjson";

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse({
      search: url.searchParams.get("search") ?? undefined,
      minPrice: url.searchParams.get("minPrice") ?? undefined,
      maxPrice: url.searchParams.get("maxPrice") ?? undefined,
      verifiedOnly: url.searchParams.get("verifiedOnly") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const page = input.page ?? 1;
    const limit = input.limit ?? 24;
    const offset = (page - 1) * limit;

    // The tutor directory lists bookable 1:1 tutors only: an active teacher
    // with a slug and a finished profile (same gate as a public profile, see
    // endpoints/teachers/profile_GET.ts) who has 1:1 sessions switched on at a
    // valid rate - the same test endpoints/mentorship/teacher-offerings_GET.ts
    // uses to decide whether the profile shows the Book button.
    let baseQuery = db
      .selectFrom("users")
      .where("role", "=", "teacher")
      .where("isActive", "=", true)
      .where("onboardingCompleted", "=", true)
      .where("slug", "is not", null)
      .where("mentorshipEnabled", "=", true)
      .where("liveTeachingStatus", "=", "approved")
      .where(sql<number>`COALESCE(mentorship_rate_per_unit, 0)`, ">=", MENTORSHIP_MIN_RATE_PER_UNIT);

    if (input.search) {
      const searchQuery = `%${input.search}%`;
      baseQuery = baseQuery.where((eb) =>
        eb.or([
          eb("displayName", "ilike", searchQuery),
          eb("tagline", "ilike", searchQuery),
          eb("academyName", "ilike", searchQuery),
        ])
      );
    }

    if (input.verifiedOnly) {
      baseQuery = baseQuery.where("isVerified", "=", true);
    }

    // Price per 25-min 1:1 lesson = the teacher's flat rate, enforced server-side at
    // MENTORSHIP_MIN_RATE_PER_UNIT when mentorship is enabled (mirrors
    // endpoints/mentorship/teacher-offerings_GET.ts). Teachers without 1:1 enabled have no price
    // and are left out of a price-filtered search, same as Preply excludes tutors with no lesson rate.
    const priceExpr = sql<number>`GREATEST(COALESCE(mentorship_rate_per_unit, 0), ${MENTORSHIP_MIN_RATE_PER_UNIT})`;

    if (input.minPrice != null) {
      baseQuery = baseQuery.where(priceExpr, ">=", input.minPrice);
    }
    if (input.maxPrice != null) {
      baseQuery = baseQuery.where(priceExpr, "<=", input.maxPrice);
    }

    const ratingAndStudentsSelect = [
      sql<string>`(
        SELECT COALESCE(SUM(rating * reviews_count), 0)
        FROM courses WHERE courses.teacher_id = users.id AND courses.status = 'published'
      ) + (
        SELECT COALESCE(SUM(rating * reviews_count), 0)
        FROM mock_tests WHERE mock_tests.teacher_id = users.id AND mock_tests.is_published = true AND mock_tests.deleted_at IS NULL
      )`.as("ratingWeightedSum"),
      sql<string>`(
        SELECT COALESCE(SUM(reviews_count), 0)
        FROM courses WHERE courses.teacher_id = users.id AND courses.status = 'published'
      ) + (
        SELECT COALESCE(SUM(reviews_count), 0)
        FROM mock_tests WHERE mock_tests.teacher_id = users.id AND mock_tests.is_published = true AND mock_tests.deleted_at IS NULL
      )`.as("totalReviews"),
      sql<string>`(
        SELECT COALESCE(SUM(students_enrolled), 0)
        FROM mock_tests WHERE mock_tests.teacher_id = users.id AND mock_tests.is_published = true AND mock_tests.deleted_at IS NULL
      )`.as("totalStudents"),
      sql<string>`(
        SELECT COUNT(*) FROM mentorship_bookings
        WHERE mentorship_bookings.teacher_id = users.id AND mentorship_bookings.status = 'completed'
      ) + (
        SELECT COUNT(*) FROM group_lessons
        WHERE group_lessons.teacher_id = users.id AND group_lessons.status = 'completed'
      )`.as("totalLessons"),
    ] as const;

    let listQuery = baseQuery
      .select([
        "id",
        "slug",
        "displayName",
        "avatarUrl",
        "tagline",
        "bio",
        "location",
        "academyName",
        "isVerified",
        "yearsOfExperience",
        "expertiseAreas",
        "teachingCategories",
        "languages",
        "mentorshipEnabled",
        "mentorshipRatePerUnit",
        "mentorshipClassPrice50",
        "mentorshipTrialPrice25",
        "mentorshipTrialPrice50",
        ...ratingAndStudentsSelect,
      ])
      .limit(limit)
      .offset(offset);

    switch (input.sortBy) {
      case "price_asc":
        listQuery = listQuery.orderBy(priceExpr, "asc");
        break;
      case "price_desc":
        listQuery = listQuery.orderBy(priceExpr, "desc");
        break;
      case "rating":
        listQuery = listQuery.orderBy(sql`"ratingWeightedSum" / NULLIF("totalReviews", 0)`, "desc");
        break;
      default:
        listQuery = listQuery.orderBy("isVerified", "desc").orderBy("createdAt", "desc");
    }

    const [rows, totalResult, priceBoundsRow] = await Promise.all([
      listQuery.execute(),
      baseQuery.select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow(),
      db
        .selectFrom("users")
        .where("role", "=", "teacher")
        .where("isActive", "=", true)
        .where("mentorshipEnabled", "=", true)
        .select([
          sql<string>`MIN(${priceExpr})`.as("min"),
          sql<string>`MAX(${priceExpr})`.as("max"),
        ])
        .executeTakeFirst(),
    ]);

    const totalCount = parseInt(totalResult.count, 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const teachers: ExpertListItem[] = rows
      .filter((r) => !!r.slug)
      .map((r) => {
        const ratingWeightedSum = parseFloat(r.ratingWeightedSum as any);
        const totalReviews = parseInt(r.totalReviews as any, 10);
        const rate = r.mentorshipRatePerUnit != null ? Math.max(Number(r.mentorshipRatePerUnit), MENTORSHIP_MIN_RATE_PER_UNIT) : null;
        const livePrices = r.mentorshipEnabled && rate != null ? resolveLivePrices(r) : null;
        return {
          id: r.id,
          slug: r.slug as string,
          displayName: r.displayName,
          avatarUrl: r.avatarUrl,
          tagline: r.tagline,
          bio: r.bio,
          location: r.location,
          academyName: r.academyName,
          isVerified: r.isVerified,
          yearsOfExperience: r.yearsOfExperience,
          expertiseAreas: asStringArray(r.expertiseAreas),
          teachingCategories: asStringArray(r.teachingCategories),
          languages: asStringArray(r.languages),
          mentorshipEnabled: r.mentorshipEnabled,
          pricePer25Min: r.mentorshipEnabled && rate != null ? rate : null,
          trialPrice50: livePrices?.trial50 ?? null,
          trialFrom: livePrices ? Math.min(livePrices.trial25, livePrices.trial50) : null,
          rating: totalReviews > 0 ? Math.round((ratingWeightedSum / totalReviews) * 10) / 10 : null,
          reviewsCount: totalReviews,
          studentsCount: parseInt(r.totalStudents as any, 10),
          lessonsCount: parseInt(r.totalLessons as any, 10) || 0,
        };
      });

    const output: OutputType = {
      teachers,
      totalCount,
      currentPage: page,
      totalPages,
      priceBounds: {
        min: priceBoundsRow?.min != null ? Math.floor(Number(priceBoundsRow.min)) : MENTORSHIP_MIN_RATE_PER_UNIT,
        max: priceBoundsRow?.max != null ? Math.ceil(Number(priceBoundsRow.max)) : MENTORSHIP_MIN_RATE_PER_UNIT,
      },
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing experts:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
