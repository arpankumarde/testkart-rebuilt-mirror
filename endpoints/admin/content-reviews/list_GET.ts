import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  ContentMeta,
  CourseBundleMeta,
  CourseMeta,
  DigitalProductMeta,
  LiveTestMeta,
  MockTestMeta,
  OutputType,
} from "./list_GET.schema";
import { sql } from "kysely";

async function fetchMockTestMeta(
  ids: number[]
): Promise<Map<number, MockTestMeta>> {
  if (ids.length === 0) return new Map();

  const rows = await db
    .selectFrom("mockTests as mt")
    .leftJoin("mockTestItems as mti", "mti.packageId", "mt.id")
    .leftJoin("testQuestions as tq", "tq.testId", "mti.id")
    .select([
      "mt.id",
      "mt.price",
      "mt.examName",
      "mt.isFree",
      "mt.rating",
      "mt.reviewsCount",
      "mt.studentsEnrolled",
      "mt.description",
      "mt.thumbnailUrl",
      "mt.language",
      "mt.discountPrice",
      "mt.freeTestsCount",
      sql<string>`count(distinct mti.id)`.as("totalTests"),
      sql<string>`count(tq.id)`.as("totalQuestions"),
      sql<string>`count(tq.id) filter (where tq.is_ai_generated = true)`.as(
        "aiQuestionsCount"
      ),
      sql<string>`count(tq.id) filter (where tq.is_ai_generated is false or tq.is_ai_generated is null)`.as(
        "manualQuestionsCount"
      ),
      sql<string>`(
        select count(oi.id)
        from order_items oi
        inner join orders o on o.id = oi.order_id
        where oi.mock_test_id = mt.id
          and o.status = 'completed'
      )`.as("totalOrders"),
    ])
    .where("mt.id", "in", ids)
    .groupBy([
      "mt.id",
      "mt.price",
      "mt.examName",
      "mt.isFree",
      "mt.rating",
      "mt.reviewsCount",
      "mt.studentsEnrolled",
      "mt.description",
      "mt.thumbnailUrl",
      "mt.language",
      "mt.discountPrice",
      "mt.freeTestsCount",
    ])
    .execute();

  const result = new Map<number, MockTestMeta>();
  for (const row of rows) {
    result.set(row.id, {
      type: "mock_test",
      totalTests: parseInt(row.totalTests, 10),
      totalQuestions: parseInt(row.totalQuestions, 10),
      price: row.price,
      examName: row.examName ?? null,
      isFree: row.isFree,
      rating: row.rating ?? null,
      reviewsCount: row.reviewsCount,
      studentsEnrolled: row.studentsEnrolled,
      description: row.description ?? null,
      thumbnailUrl: row.thumbnailUrl ?? null,
      language: row.language ?? null,
      discountPrice: row.discountPrice ?? null,
      freeTestsCount: row.freeTestsCount,
      aiQuestionsCount: parseInt(row.aiQuestionsCount, 10),
      manualQuestionsCount: parseInt(row.manualQuestionsCount, 10),
      totalOrders: parseInt(row.totalOrders, 10),
    });
  }
  return result;
}

async function fetchCourseMeta(
  ids: number[]
): Promise<Map<number, CourseMeta>> {
  if (ids.length === 0) return new Map();

  const rows = await db
    .selectFrom("courses as c")
    .leftJoin("courseSections as cs", "cs.courseId", "c.id")
    .leftJoin("courseLessons as cl", "cl.sectionId", "cs.id")
    .select([
      "c.id",
      "c.price",
      "c.level",
      "c.category",
      "c.estimatedDurationMinutes",
      "c.description",
      "c.thumbnailUrl",
      "c.language",
      sql<string>`count(distinct cs.id)`.as("sectionsCount"),
      sql<string>`count(cl.id)`.as("lessonsCount"),
      sql<string>`(
        select count(ce.id)
        from course_enrollments ce
        where ce.course_id = c.id
      )`.as("totalPurchases"),
      sql<string | null>`(
        select avg(r.rating)::text
        from reviews r
        where r.mock_test_id is null and r.digital_product_id is null
          and exists (
            select 1 from course_enrollments ce2
            where ce2.course_id = c.id and ce2.student_id = r.user_id
          )
      )`.as("rating"),
      sql<string>`(
        select count(r.id)
        from reviews r
        where r.mock_test_id is null and r.digital_product_id is null
          and exists (
            select 1 from course_enrollments ce2
            where ce2.course_id = c.id and ce2.student_id = r.user_id
          )
      )`.as("reviewsCount"),
    ])
    .where("c.id", "in", ids)
    .groupBy([
      "c.id",
      "c.price",
      "c.level",
      "c.category",
      "c.estimatedDurationMinutes",
      "c.description",
      "c.thumbnailUrl",
      "c.language",
    ])
    .execute();

  const result = new Map<number, CourseMeta>();
  for (const row of rows) {
    result.set(row.id, {
      type: "course",
      sectionsCount: parseInt(row.sectionsCount, 10),
      lessonsCount: parseInt(row.lessonsCount, 10),
      price: row.price,
      level: row.level,
      category: row.category ?? null,
      estimatedDurationMinutes: row.estimatedDurationMinutes ?? null,
      description: row.description ?? null,
      thumbnailUrl: row.thumbnailUrl ?? null,
      language: row.language ?? null,
      totalPurchases: parseInt(row.totalPurchases, 10),
      rating: row.rating ?? null,
      reviewsCount: parseInt(row.reviewsCount, 10),
    });
  }
  return result;
}

async function fetchDigitalProductMeta(
  ids: number[]
): Promise<Map<number, DigitalProductMeta>> {
  if (ids.length === 0) return new Map();

  const rows = await db
    .selectFrom("digitalProducts")
    .select([
      "id",
      "price",
      "category",
      "pageCount",
      "fileSizeBytes",
      "pdfUrl",
      "description",
      "thumbnailUrl",
      "language",
      "totalPurchases",
      "rating",
      "reviewsCount",
      "previewPages",
    ])
    .where("id", "in", ids)
    .execute();

  const result = new Map<number, DigitalProductMeta>();
  for (const row of rows) {
    result.set(row.id, {
      type: "digital_product",
      pageCount: row.pageCount ?? null,
      price: row.price,
      category: row.category ?? null,
      fileSizeBytes: row.fileSizeBytes ?? null,
      pdfUrl: row.pdfUrl ?? null,
      description: row.description ?? null,
      thumbnailUrl: row.thumbnailUrl ?? null,
      language: row.language ?? null,
      totalPurchases: row.totalPurchases ?? 0,
      rating: row.rating ?? null,
      reviewsCount: row.reviewsCount ?? 0,
      previewPages: row.previewPages ?? null,
    });
  }
  return result;
}

async function fetchCourseBundleMeta(
  ids: number[]
): Promise<Map<number, CourseBundleMeta>> {
  if (ids.length === 0) return new Map();

  const rows = await db
    .selectFrom("courseBundles as cb")
    .leftJoin("courseBundleItems as cbi", "cbi.bundleId", "cb.id")
    .select([
      "cb.id",
      "cb.price",
      "cb.originalPrice",
      "cb.discountPercentage",
      "cb.description",
      "cb.thumbnailUrl",
      sql<string>`count(cbi.id)`.as("itemsCount"),
    ])
    .where("cb.id", "in", ids)
    .groupBy([
      "cb.id",
      "cb.price",
      "cb.originalPrice",
      "cb.discountPercentage",
      "cb.description",
      "cb.thumbnailUrl",
    ])
    .execute();

  const result = new Map<number, CourseBundleMeta>();
  for (const row of rows) {
    result.set(row.id, {
      type: "course_bundle",
      itemsCount: parseInt(row.itemsCount, 10),
      price: row.price,
      originalPrice: row.originalPrice,
      discountPercentage: row.discountPercentage ?? null,
      description: row.description ?? null,
      thumbnailUrl: row.thumbnailUrl ?? null,
    });
  }
  return result;
}

async function fetchLiveTestMeta(
  ids: number[]
): Promise<Map<number, LiveTestMeta>> {
  if (ids.length === 0) return new Map();

  const rows = await db
    .selectFrom("liveTests as lt")
    .innerJoin("mockTests as mt", "mt.id", "lt.mockTestId")
    .select([
      "lt.id",
      "lt.startTime",
      "lt.endTime",
      "lt.maxSeats",
      "lt.price",
      "lt.totalPrizePool",
      "lt.hasPrizes",
      "lt.enrolledCount",
      "lt.description",
      "mt.thumbnailUrl as mockTestThumbnailUrl",
      "lt.thumbnailUrl as liveTestThumbnailUrl",
    ])
    .where("lt.id", "in", ids)
    .execute();

  const result = new Map<number, LiveTestMeta>();
  for (const row of rows) {
    result.set(row.id, {
      type: "live_test",
      startTime: row.startTime ?? null,
      endTime: row.endTime,
      maxSeats: row.maxSeats,
      price: row.price,
      totalPrizePool: row.totalPrizePool,
      hasPrizes: row.hasPrizes,
      enrolledCount: row.enrolledCount,
      description: row.description ?? null,
      thumbnailUrl: row.liveTestThumbnailUrl ?? row.mockTestThumbnailUrl ?? null,
    });
  }
  return result;
}

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const contentType = url.searchParams.get("contentType") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.max(
      1,
      Math.min(100, parseInt(url.searchParams.get("limit") || "20", 10))
    );
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("contentReviews as cr")
      .innerJoin("users as u", "u.id", "cr.teacherId")
      .select([
        "cr.id",
        "cr.contentType",
        "cr.contentId",
        "cr.teacherId",
        "cr.status",
        "cr.adminNotes",
        "cr.reviewedAt",
        "cr.createdAt",
        "u.displayName as teacherName",
        "u.email as teacherEmail",
        sql<string>`
          CASE cr.content_type
            WHEN 'mock_test' THEN (SELECT mt.title FROM mock_tests mt WHERE mt.id = cr.content_id)
            WHEN 'course' THEN (SELECT c.title FROM courses c WHERE c.id = cr.content_id)
            WHEN 'digital_product' THEN (SELECT dp.title FROM digital_products dp WHERE dp.id = cr.content_id)
            WHEN 'course_bundle' THEN (SELECT cb.title FROM course_bundles cb WHERE cb.id = cr.content_id)
            WHEN 'live_test' THEN (SELECT lt.title FROM live_tests lt WHERE lt.id = cr.content_id)
            ELSE 'Unknown'
          END
        `.as("contentTitle"),
      ])
      .orderBy("cr.createdAt", "desc");

    let countQuery = db
      .selectFrom("contentReviews as cr")
      .innerJoin("users as u", "u.id", "cr.teacherId")
      .select(db.fn.countAll<string>().as("count"));

    if (status) {
      query = query.where("cr.status", "=", status as any);
      countQuery = countQuery.where("cr.status", "=", status as any);
    }

    if (contentType) {
      query = query.where("cr.contentType", "=", contentType as any);
      countQuery = countQuery.where("cr.contentType", "=", contentType as any);
    }

    if (search) {
      const searchPattern = `%${search}%`;
      const searchCondition = sql<boolean>`
        CASE cr.content_type
          WHEN 'mock_test' THEN EXISTS (SELECT 1 FROM mock_tests mt WHERE mt.id = cr.content_id AND mt.title ILIKE ${searchPattern})
          WHEN 'course' THEN EXISTS (SELECT 1 FROM courses c WHERE c.id = cr.content_id AND c.title ILIKE ${searchPattern})
          WHEN 'digital_product' THEN EXISTS (SELECT 1 FROM digital_products dp WHERE dp.id = cr.content_id AND dp.title ILIKE ${searchPattern})
          WHEN 'course_bundle' THEN EXISTS (SELECT 1 FROM course_bundles cb WHERE cb.id = cr.content_id AND cb.title ILIKE ${searchPattern})
          WHEN 'live_test' THEN EXISTS (SELECT 1 FROM live_tests lt WHERE lt.id = cr.content_id AND lt.title ILIKE ${searchPattern})
          ELSE FALSE
        END
      `;
      query = query.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }

    query = query.limit(limit).offset(offset);

    const [rows, countResult] = await Promise.all([
      query.execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    // Group content IDs by type for batch metadata fetching
    const mockTestIds: number[] = [];
    const courseIds: number[] = [];
    const digitalProductIds: number[] = [];
    const courseBundleIds: number[] = [];
    const liveTestIds: number[] = [];

    for (const row of rows) {
      switch (row.contentType) {
        case "mock_test":
          mockTestIds.push(row.contentId);
          break;
        case "course":
          courseIds.push(row.contentId);
          break;
        case "digital_product":
          digitalProductIds.push(row.contentId);
          break;
        case "course_bundle":
          courseBundleIds.push(row.contentId);
          break;
        case "live_test":
          liveTestIds.push(row.contentId);
          break;
      }
    }

    // Batch fetch metadata for all content types in parallel
    const [
      mockTestMetaMap,
      courseMetaMap,
      digitalProductMetaMap,
      courseBundleMetaMap,
      liveTestMetaMap,
    ] = await Promise.all([
      fetchMockTestMeta(mockTestIds),
      fetchCourseMeta(courseIds),
      fetchDigitalProductMeta(digitalProductIds),
      fetchCourseBundleMeta(courseBundleIds),
      fetchLiveTestMeta(liveTestIds),
    ]);

    const getContentMeta = (
      contentType: string,
      contentId: number
    ): ContentMeta | null => {
      switch (contentType) {
        case "mock_test":
          return mockTestMetaMap.get(contentId) ?? null;
        case "course":
          return courseMetaMap.get(contentId) ?? null;
        case "digital_product":
          return digitalProductMetaMap.get(contentId) ?? null;
        case "course_bundle":
          return courseBundleMetaMap.get(contentId) ?? null;
        case "live_test":
          return liveTestMetaMap.get(contentId) ?? null;
        default:
          return null;
      }
    };

    const totalCount = parseInt(countResult.count, 10);
    const totalPages = Math.ceil(totalCount / limit);

    const output: OutputType = {
      reviews: rows.map((r) => ({
        id: r.id,
        contentType: r.contentType,
        contentId: r.contentId,
        contentTitle: r.contentTitle ?? "Unknown",
        teacherName: r.teacherName,
        teacherEmail: r.teacherEmail ?? "N/A",
        teacherId: r.teacherId,
        status: r.status,
        adminNotes: r.adminNotes ?? null,
        reviewedAt: r.reviewedAt ?? null,
        createdAt: r.createdAt,
        contentMeta: getContentMeta(r.contentType, r.contentId),
      })),
      totalCount,
      currentPage: page,
      totalPages,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error listing content reviews:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), {
      status:
        error instanceof Error && error.name === "NotAuthenticatedError"
          ? 401
          : 500,
    });
  }
}