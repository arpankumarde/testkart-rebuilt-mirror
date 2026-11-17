import { sql } from "kysely";
import { db } from "./db";
import { MENTORSHIP_MIN_CLASS_PRICE } from "./liveLessonConfig";
import { pricesMeetFloors, resolveLivePrices } from "./livePricing";
import { bookableTutorCondition } from "./bookableTutorCondition";
import { schema } from "../endpoints/experts/list_GET.schema";
import type { OutputType, ExpertListItem } from "../endpoints/experts/list_GET.schema";

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

/**
 * The tutor directory listing. Shared by endpoints/experts/list_GET.ts and pages/expert.prefetch.ts,
 * which cannot call the endpoint over the network during the server render. Takes raw values
 * (query-string strings or numbers) and validates them with the endpoint's schema.
 */
export async function fetchExpertsListServer(rawInput: Record<string, unknown>): Promise<OutputType> {
  const input = schema.parse(rawInput);
  const page = input.page ?? 1;
  const limit = input.limit ?? 24;
  const offset = (page - 1) * limit;

  let baseQuery = db.selectFrom("teachers").where(bookableTutorCondition);

  if (input.search) {
    const searchQuery = `%${input.search}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb("displayName", "ilike", searchQuery),
        eb("tagline", "ilike", searchQuery),
        eb("academyName", "ilike", searchQuery),
        sql<boolean>`COALESCE(expertise_areas::text, '') ILIKE ${searchQuery}`,
        sql<boolean>`COALESCE(teaching_categories::text, '') ILIKE ${searchQuery}`,
      ])
    );
  }

  if (input.verifiedOnly) {
    baseQuery = baseQuery.where("isVerified", "=", true);
  }

  // Price filters and sorting use the full session (50 min) class price.
  const priceExpr = sql<number>`GREATEST(COALESCE(mentorship_class_price60, 0), ${MENTORSHIP_MIN_CLASS_PRICE[50]})`;

  if (input.minPrice != null) {
    baseQuery = baseQuery.where(priceExpr, ">=", input.minPrice);
  }
  if (input.maxPrice != null) {
    baseQuery = baseQuery.where(priceExpr, "<=", input.maxPrice);
  }

  const ratingAndStudentsSelect = [
    sql<string>`(
      SELECT COALESCE(SUM(rating * reviews_count), 0)
      FROM courses WHERE courses.teacher_id = teachers.id AND courses.status = 'published'
    ) + (
      SELECT COALESCE(SUM(rating * reviews_count), 0)
      FROM mock_tests WHERE mock_tests.teacher_id = teachers.id AND mock_tests.is_published = true AND mock_tests.deleted_at IS NULL
    )`.as("ratingWeightedSum"),
    sql<string>`(
      SELECT COALESCE(SUM(reviews_count), 0)
      FROM courses WHERE courses.teacher_id = teachers.id AND courses.status = 'published'
    ) + (
      SELECT COALESCE(SUM(reviews_count), 0)
      FROM mock_tests WHERE mock_tests.teacher_id = teachers.id AND mock_tests.is_published = true AND mock_tests.deleted_at IS NULL
    )`.as("totalReviews"),
    sql<string>`(
      SELECT COALESCE(SUM(students_enrolled), 0)
      FROM mock_tests WHERE mock_tests.teacher_id = teachers.id AND mock_tests.is_published = true AND mock_tests.deleted_at IS NULL
    )`.as("totalStudents"),
    sql<string>`(
      SELECT COUNT(*) FROM mentorship_bookings
      WHERE mentorship_bookings.teacher_id = teachers.id AND mentorship_bookings.status = 'completed'
    ) + (
      SELECT COUNT(*) FROM group_lessons
      WHERE group_lessons.teacher_id = teachers.id AND group_lessons.status = 'completed'
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
      "mentorshipClassPrice60",
      "mentorshipTrialDiscount",
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
      .selectFrom("teachers")
      .where("isActive", "=", true)
      .where("mentorshipEnabled", "=", true)
      .select([sql<string>`MIN(${priceExpr})`.as("min"), sql<string>`MAX(${priceExpr})`.as("max")])
      .executeTakeFirst(),
  ]);

  const totalCount = parseInt(totalResult.count, 10);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const teachers: ExpertListItem[] = rows
    .filter((r) => !!r.slug)
    .map((r) => {
      const ratingWeightedSum = parseFloat(r.ratingWeightedSum as any);
      const totalReviews = parseInt(r.totalReviews as any, 10);
      const resolved = r.mentorshipEnabled ? resolveLivePrices(r) : null;
      const livePrices = resolved && pricesMeetFloors(resolved) ? resolved : null;
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
        priceFull: livePrices?.classFull ?? null,
        trialPriceFull: livePrices?.trialFull ?? null,
        trialFrom: livePrices ? Math.min(livePrices.trialShort, livePrices.trialFull) : null,
        rating: totalReviews > 0 ? Math.round((ratingWeightedSum / totalReviews) * 10) / 10 : null,
        reviewsCount: totalReviews,
        studentsCount: parseInt(r.totalStudents as any, 10),
        lessonsCount: parseInt(r.totalLessons as any, 10) || 0,
      };
    });

  return {
    teachers,
    totalCount,
    currentPage: page,
    totalPages,
    priceBounds: {
      min: priceBoundsRow?.min != null ? Math.floor(Number(priceBoundsRow.min)) : MENTORSHIP_MIN_CLASS_PRICE[50],
      max: priceBoundsRow?.max != null ? Math.ceil(Number(priceBoundsRow.max)) : MENTORSHIP_MIN_CLASS_PRICE[50],
    },
  };
}